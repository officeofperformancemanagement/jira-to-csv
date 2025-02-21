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
- [timeinstatus](https://marketplace.atlassian.com/apps/1219732/time-in-status)

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

    // all parameters below are optional
    debug_level: 10,

    // custom jql (can only be specified if project parameter above is undefined)
    jql: "...",

    // specify columns to include in output
    // columns not in this array will be excluded from the output
    columns: ["ID", "Summary", "Time to resolution: Elapsed Time"],

    // only write each column if it actually contains values. default is false
    drop_empty_columns: true,

    // default is 2000
    // how many mimilliseconds to wait between requests
    wait: 50,

    // default is false
    // split time in status information across multiple columns
    // each status has two columns: count and duration
    expand_time_in_status: true,

    // set maximum length of issue description
    // overflow is replaced by "..."
    max_description_length: 100,

    // number of issues to skip
    offset: 12345,

    // remove all new lines from field values, ensuring each row takes up only one line
    remove_new_lines: false,

    // default is semi-colon
    // separator between multiple values within one "cell"
    subdelimiter: "|",

    // default is true
    // whether to sort values within a cell
    sort: false
});

fs.writeFileSync("./issues.csv", csv);
```

