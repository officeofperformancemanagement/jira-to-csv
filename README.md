# jira-to-csv
> export JIRA issues to a CSV file

## features
- custom fields
- pagination
- plugins

## install
```sh
npm install jira-to-csv
```

## supported plugins
- servicedesk-lingo-integration-plugin

## usage
```js
const fs = require("node:fs");
const jiraToCsv = require("jira-to-csv");

const { csv } = jiraToCsv.export_issues({
    // required parameters
    domain: "https://example.atlassian.net",
    project: "ABC",
    api_token: "71236DSFg6gq566D123u67",
    user_email: "user@example.org",

    // optional parameters below
    debug_level: 10,

    // custom jql (can only be specified if project parameter above is undefined)
    jql: "...",

    // only write each column if it actually contains values. default is false
    skipEmptyColumns: true,

    // how many mimilliseconds to wait between requests
    wait: 50,
});

fs.writeFileSync("./issues.csv", csv);
```

