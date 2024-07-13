# jira-to-csv
> export JIRA issues to a CSV file

## features
- custom fields
- pagination

## install
```sh
npm install jira-to-csv
```

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

    // custom jql (can only be provided if project parameter above is undefined)
    jql: "...",

    // process array of row objects before converting them to csv
    onbeforeconvert: ({ rows }) => {
      rows.forEach(row => {
          row['Thing Count'] = row['Things'].split(",").length
      });
    },

    // only write each column if it actually contains values. default is false
    skipEmptyColumns: true,

    // how many mimilliseconds to wait between requests
    wait: 50,
});

fs.writeFileSync("./issues.csv", csv);
```

