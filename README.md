# Salesforce-Autoload
Node.js based tool for moving data between salesforce environment. Runs on console.

To run the program, you can use npm run index, or you can build it using [pgk.js](https://www.npmjs.com/package/pkg).

---

It will ask for an JSON config file, that contains all the data it needs to run the load. Here's an example of what that should look like:

```json
{
    "auth": [
        {
            "name": "",
            "username": "",
            "password": "",
            "token": "",
            "loginUrl": ""
        }
    ],
    "settings": {
        "maxRequest": 200
    },
    "codes": {
        "KEYS_TO_USE_ON_QUERY": ["KEY_ONE", "KEY_TWO"]
    },
    "loads": [
        {
            "object": "Account",
            "query": "SELECT {FIELDS} FROM Account WHERE Example_External_Key__c IN {KEYS_TO_USE_ON_QUERY}",
            "fields": [
                "Id",
                "Name",
                "Example_External_Key__c"
            ],
            "externalId": "Example_External_Key__c"
        }
    ]
}
```

Note that, if there is no **externalId** the code will do an **insert** and not the default **upsert**.

---

This is more like a proof of concept, and i'm working on a much better tools that will have a user interface, and be much more flexible than this one, thus this will not be update to include more features or fix any bugs

---

DISCLAIMER
----------

This tool is not in any way endorsed by Salesforce, it's just a project that i did to help me on day-to-day tasks, use it at your own risks.
