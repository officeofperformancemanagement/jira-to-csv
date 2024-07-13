const { convert } = require("@danieljdufour/json-to-csv");

const sleep = ms => new Promise(resolve => setTimeout(() => resolve(), ms));

const clone = obj => JSON.parse(JSON.stringify(obj));

async function get_fields({ api_token, custom = false, domain, debug_level = 0, max_requests = 1000, wait = 2000, user_email }) {
  if (typeof fetch !== "function") {
    throw new Error("[jira-to-csv] it looks like fetch is undefined. Try upgrading NodeJS to a more recent version.");
  }

  const headers = {};
  if (user_email && api_token) {
    headers.Authorization = "Basic " + Buffer.from(user_email + ":" + api_token).toString("base64");
  }

  const params = new URLSearchParams();
  if (custom) params.set("type", "custom");

  const url = domain + "/rest/api/3/field/search";
  let startAt = 0;
  let results = [];
  for (let i = 0; i < max_requests; i++) {
    if (i >= 1 && typeof wait === "number") {
      if (debug_level >= 3) console.log(`[jira-to-csv] sleeping for ${wait}ms`);
      await sleep(wait);
    }

    params.set("startAt", startAt);

    const fetch_url = url + "?" + params.toString();
    if (debug_level >= 3) console.log(`[jira-to-csv] fetching "${fetch_url}"`);
    const response = await fetch(fetch_url, { headers });
    if (debug_level >= 3) console.log(`[jira-to-csv] response.status: "${response.status}"`);

    if (response.status !== 200) {
      throw Error(`[jira-to-csv] invalid response status of ${response.status}`);
    }

    const data = await response.json();
    if (debug_level >= 3) console.log(`[jira-to-csv] data:`, data);
    if (data.values.length === 0) break;

    results = results.concat(data.values);

    startAt += data.values.length;
  }

  if (debug_level >= 3) console.log(`[jira-to-csv] results:`, results);

  return { fields: results };
}

async function export_issues({
  columns,
  debug_level = false,
  domain,
  headers,
  max_issues,
  max_requests = 1000,
  project,
  jql,
  api_token,
  user_email,
  wait = 2000, // sleep between requests
  ...rest
}) {
  if (typeof fetch !== "function") {
    throw new Error("[jira-to-csv] it looks like fetch is undefined. Try upgrading NodeJS to a more recent version.");
  }

  headers = headers ? clone(headers) : {};

  if (user_email && api_token) {
    headers.Authorization = "Basic " + Buffer.from(user_email + ":" + api_token).toString("base64");
  }

  if (!columns) {
    columns = [
      { name: "ID", path: "id" },
      { name: "Key", path: "key" },
      { name: "URL", path: "self" },
      { name: "Created", path: "fields.created" },
      { name: "Summary", path: "fields.summary" },
      { name: "Description", path: "fields.description" },
      { name: "Labels", path: "fields.labels" },
      { name: "Assignee Name", path: "fields.assignee.displayName" },
      { name: "Assignee Email", path: "fields.assignee.emailAddress" },
      { name: "Creator Name", path: "fields.creator.displayName" },
      { name: "Creator Email", path: "fields.creator.emailAddress" },
      { name: "Due Date", path: "fields.duedate" },
      { name: "Issue Type Name", path: "fields.issuetype.name" },
      { name: "Issue Type Description", path: "fields.issuetype.description" },
      { name: "Project ID", path: "fields.project.id" },
      { name: "Project Key", path: "fields.project.key" },
      { name: "Project Name", path: "fields.project.name" },
      { name: "Reporter Name", path: "fields.reporter.displayName" },
      { name: "Reporter Email", path: "fields.reporter.emailAddress" },
      { name: "Status Category Change Date", path: "fields.statuscategorychangedate" }
    ];

    // fetch list of custom fields
    const { fields: custom_fields } = await get_fields({
      api_token,
      custom: true,
      domain,
      debug_level,
      wait,
      user_email
    });

    custom_fields.forEach(({ name, id, schema }) => {
      if (schema.type === "user") {
        columns.push({ name: name + " Name", path: ["fields", id, "displayName"].join(".") });
        columns.push({ name: name + " Email", path: ["fields", id, "emailAddress"].join(".") });
      } else if (schema.type === "array" && schema.items === "user") {
        columns.push({ name: name + " Names", path: ["fields", id, "displayName"].join(".") });
        columns.push({ name: name + " Emails", path: ["fields", id, "emailAddress"].join(".") });
      } else if (schema.type === "array" && schema.items === "option") {
        columns.push({ name, path: ["fields", id, "value"].join(".") });
      } else if (schema.type === "option") {
        columns.push({ name, path: ["fields", id, "value"].join(".") });
      } else if (schema.type === "sd-request-lang" && schema.custom === "com.atlassian.servicedesk.servicedesk-lingo-integration-plugin:sd-request-language") {
        columns.push({ name: name + " Code", path: ["fields", id, "languageCode"].join(".") });
        columns.push({ name: name + " Name", path: ["fields", id, "displayName"].join(".") });
      } else {
        columns.push({ name, path: "fields." + id });
      }
    });
  }

  if (debug_level >= 3) console.log(`[jira-to-csv] columns:`, columns);

  const url = domain + "/rest/api/2/search";

  let all_issues = [];

  let startAt = 0;
  for (let i = 0; i < max_requests; i++) {
    if (debug_level >= 3) console.log(`[jira-to-csv] request number: ${i}`);

    const params = new URLSearchParams();
    if (project && jql) throw new Error("[jira-to-csv] you can't pass both project and jql");
    if (project) {
      params.set("jql", `project = '${project}'`);
    } else if (jql) {
      params.set("jql", jql);
    }
    params.set("startAt", startAt);

    if (api_token) {
      headers.Authorization = "Basic " + Buffer.from(user_email + ":" + api_token).toString("base64");
    }

    const options = {
      method: "GET",
      headers: {
        ...headers
      }
    };

    if (debug_level >= 10) console.log(`[jira-to-csv] fetch options:`, options);

    if (i >= 1 && typeof wait === "number") {
      if (debug_level >= 3) console.log(`[jira-to-csv] sleeping for ${wait}ms`);
      await sleep(wait);
    }

    const fetch_url = url + "?" + params.toString();
    if (debug_level >= 3) console.log(`[jira-to-csv] fetching "${fetch_url}"`);

    const response = await fetch(fetch_url, options);
    if (debug_level >= 3) console.log(`[jira-to-csv] response.status: "${response.status}"`);

    if (response.status !== 200) {
      throw Error(`[jira-to-csv] invalid response status of ${response.status}`);
    }

    const response_data = await response.json();
    if (debug_level >= 5) console.log(`[jira-to-csv] response_data:`, response_data);

    const response_issues = response_data.issues;

    if (debug_level >= 5) {
      console.log("[jira-to-csv] response_issues[0]:", response_issues[0]);
    }

    if (debug_level >= 2) console.log("[jira-to-csv] response_issues.length:", response_issues.length);

    if (i === 0 && response_issues.length === 0) {
      if (debug_level >= 1) console.warn(`[jira-to-csv] no response items. did you forget to authenticate?`);
    }

    if (response_issues.length === 0) break;

    all_issues = all_issues.concat(response_issues);

    if (typeof max_issues === "number" && max_issues !== Infinity) {
      if (all_issues.length >= max_issues) {
        all_issues = all_issues.slice(0, max_issues);
        break;
      }
    }

    startAt += response_issues.length;
  }

  const csv = convert(all_issues, {
    columns,
    ...rest,
    debug: false,
    quotes: true,
    start: "."
  });
  if (debug_level >= 3) console.log("[jira-to-csv] csv header:", csv.split("\n")[0].split(","));

  if (debug_level >= 3) {
    console.log("[jira-to-csv] first 500 characters of the csv:", csv.substring(0, 500));
  }

  return { csv };
}

module.exports = {
  export_issues,
  get_fields
};
