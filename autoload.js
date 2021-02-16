const chalk = require("chalk");
const inquirer = require("inquirer");
const jsforce = require("jsforce");
const ora = require("ora");
const { find, get, keys } = require("lodash");
const fs = require("fs");
const workingDir = process.cwd();
const path = require("path");

const success = (text) => chalk.green(text);
const error = (text) => chalk.red(text);
const info = (text) => chalk.blue(text);

const spinnerType = {
	interval: 80,
	frames: ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"],
};

const autoload = async (program) => {
	const files = fs.readdirSync(workingDir);

	let file = await inquirer.prompt({
		type: "list",
		name: "name",
		message: "Selecione o arquivo de configuração: ",
		choices: files.filter((file) => file.includes(".json")),
	});

	console.log(path.join(workingDir, file.name));

	const config = require(path.join(workingDir, file.name));

	const { auth, loads, codes, settings } = config;

	let ansOrigem = await inquirer.prompt({
		type: "list",
		name: "env",
		message: "Origem da extração?",
		choices: auth.map((origem) => origem.name),
	});

	let ansDestino = await inquirer.prompt({
		type: "list",
		name: "env",
		message: "Destino da carga?",
		choices: auth.map((origem) => origem.name),
	});

	let ansLoads = await inquirer.prompt({
		type: "checkbox",
		name: "loads",
		message: "Quais cargas deseja rodar?",
		choices: ["ALL", ...loads.map((load) => load.object)],
	});

	if (ansLoads.loads.length === 0) {
		console.log(error("Selecione ao menos uma carga."));
		return;
	}

	let loadsToProcess = [];

	if (ansLoads.loads.includes("ALL")) {
		loadsToProcess = loads;
	} else {
		loadsToProcess = loads.filter((load) =>
			ansLoads.loads.includes(load.object)
		);
	}

	let origem = find(auth, { name: ansOrigem.env });
	let destino = find(auth, { name: ansDestino.env });
	const connOrigem = new jsforce.Connection({
		loginUrl: origem.loginUrl,
		maxRequest: settings.maxRequest,
	});
	const connDestino = new jsforce.Connection({
		loginUrl: destino.loginUrl,
		maxRequest: settings.maxRequest,
	});
	console.log(
		info(`\nRealizando login em origem como: ${origem.username}...`)
	);
	connOrigem.login(
		origem.username,
		origem.password + origem.token,
		async (err, res) => {
			if (err) {
				return console.error(error(err));
			}
			let data;
			console.log(success("Login realizado com sucesso!\n"));
			for (const load of loadsToProcess) {
				let spinner = ora({
					spinner: spinnerType,
				}).start(`Realizando extração do objeto: ${load.object}`);
				let queryString = load.query.replace(
					"{FIELDS}",
					load.fields.join(", ")
				);
				keys(codes).forEach((code) => {
					queryString = queryString.replace(
						`{${code}}`,
						`('${codes[code].join("', '")}')`
					);
				});
				await connOrigem.query(queryString, (err, result) => {
					if (err) {
						spinner.fail(error(err));
						return;
					}
					spinner.succeed(
						`${success(
							`Realizando extração do objeto: ${load.object}`
						)}\n${info(
							`Quantidade de registros: ${result.totalSize}\nQuantidade extraída: ${result.records.length}`
						)}\n`
					);
					// console.log(`\n\n${JSON.stringify(result.records)}\n\n`);
					data = {
						...data,
						[load.object]: result.records.map((record) => {
							let filteredRecord = {};
							load.fields.forEach((field) => {
								if (field.includes(".")) {
									const splittedField = field.split(".");
									if (record[splittedField[0]] !== null) {
										// console.log({
										// 	record,
										// 	splittedField,
										// 	field,
										// });
										filteredRecord[splittedField[0]] = {
											[splittedField[1]]: get(
												record,
												field
											),
										};
									}
								} else {
									filteredRecord[field] = get(record, field);
								}
							});
							return filteredRecord;
						}),
					};
				});
			}
			console.log(
				info(`Realizando login em destino como: ${destino.username}...`)
			);
			connDestino.login(
				destino.username,
				destino.password + destino.token,
				async (err, res) => {
					if (err) {
						return console.error(error(err));
					}
					console.log(success("Login realizado com sucesso!\n"));
					for (const load of loadsToProcess) {
						if (data[load.object]) {
							let spinner = ora({
								spinner: spinnerType,
							}).start(
								`Realizando inserção do objeto: ${load.object}`
							);
							// console.log(
							// 	`\n\n${JSON.stringify(data[load.object])}\n\n`
							// );
							if (!load.externalId) {
								await connDestino
									.sobject(load.object)
									.insert(
										data[load.object],
										{ allOrNone: false },
										(err, result) => {
											let errors = [];
											(result || []).forEach((res) => {
												if (res.errors.length > 0) {
													errors = [
														...errors,
														...res.errors,
													];
												}
											});
											if (err || errors.length > 0) {
												spinner.fail(
													`Falha na inserção do objeto: ${load.object}`
												);
												errors.forEach((varErr) =>
													console.log(varErr)
												);
												return;
											}
											spinner.succeed(
												success(
													`Realizando inserção do objeto: ${load.object}`
												)
											);
										}
									);
							} else {
								await connDestino
									.sobject(load.object)
									.upsert(
										data[load.object],
										load.externalId,
										{ allOrNone: false },
										(err, result) => {
											let errors = [];
											(result || []).forEach((res) => {
												if (res.errors.length > 0) {
													errors = [
														...errors,
														...res.errors,
													];
												}
											});
											if (err || errors.length > 0) {
												spinner.fail(
													`Falha na inserção do objeto: ${load.object}`
												);
												errors.forEach((varErr) =>
													console.log(varErr)
												);
												return;
											}
											spinner.succeed(
												success(
													`Realizando inserção do objeto: ${load.object}`
												)
											);
										}
									);
							}
						}
					}
				}
			);
		}
	);
};

module.exports = { autoload };
