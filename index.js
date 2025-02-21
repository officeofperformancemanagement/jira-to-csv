const sendero = require("sendero");
const memsafe = require("memsafe");
const papaparse = require("papaparse");

const sleep = ms => new Promise(resolve => setTimeout(() => resolve(), ms));

const clone = obj => JSON.parse(JSON.stringify(obj));

async function get_statuses({ api_token, domain, debug_level = 0, max_requests = 1000, wait = 2000, user_email }) {
  if (typeof fetch !== "function") {
    throw new Error("[jira-to-csv] it looks like fetch is undefined. Try upgrading NodeJS to a more recent version.");
  }

  const headers = {};
  if (user_email && api_token) {
    headers.Authorization = "Basic " + Buffer.from(user_email + ":" + api_token).toString("base64");
  }

  const params = new URLSearchParams();

  const url = domain + "/rest/api/3/statuses/search";
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

  return { statuses: results };
}

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
  columns: column_names,
  debug_level = false,
  domain,
  headers,
  max_issues,
  max_requests = 1000,
  project,
  jql,
  api_token,
  user_email,
  wait = 2000, // sleep between requests,
  expand_time_in_status = false, // expand time in status value to multiple columns
  max_description_length,
  drop_empty_columns = false,
  subdelimiter = "; ",
  sort: _sort = true,
  remove_new_lines = false,
  offset = 0
}) {
  if (typeof fetch !== "function") {
    throw new Error("[jira-to-csv] it looks like fetch is undefined. Try upgrading NodeJS to a more recent version.");
  }

  headers = headers ? clone(headers) : {};

  if (user_email && api_token) {
    headers.Authorization = "Basic " + Buffer.from(user_email + ":" + api_token).toString("base64");
  }

  // fetch list of custom fields
  const { fields: custom_fields } = await get_fields({
    api_token,
    custom: true,
    domain,
    debug_level,
    wait,
    user_email
  });

  const { statuses } = await get_statuses({
    api_token,
    domain,
    debug_level,
    wait,
    user_email
  });

  const status_by_id = Object.fromEntries(statuses.map(status => [status.id, status]));

  const time_in_status_field_id = custom_fields.find(field => field.name === "[CHART] Time in Status")?.id;
  if (debug_level >= 3) console.log(`[jira-to-csv] time_in_status_field_id: ${time_in_status_field_id}`);

  let columns = [
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

  for (let i = 0; i < custom_fields.length; i++) {
    const { name, id, schema } = custom_fields[i];
    const same_name_count = columns.filter(col => col.name === name).length + custom_fields.slice(0, i).filter(col => col.name === name).length;
    const suffix = same_name_count === 0 ? "" : ` (${same_name_count + 1})`;
    const column_name = name + suffix;
    if (schema.type === "user") {
      columns.push({ name: column_name + " Name", path: ["fields", id, "displayName"].join(".") });
      columns.push({ name: column_name + " Email", path: ["fields", id, "emailAddress"].join(".") });
    } else if (schema.type === "array" && schema.items === "user") {
      columns.push({ name: column_name + " Names", path: ["fields", id, "displayName"].join(".") });
      columns.push({ name: column_name + " Emails", path: ["fields", id, "emailAddress"].join(".") });
    } else if (schema.type === "array" && schema.items === "option") {
      columns.push({ name: column_name, path: ["fields", id, "value"].join(".") });
    } else if (schema.type === "option") {
      columns.push({ name: column_name, path: ["fields", id, "value"].join(".") });
    } else if (schema.type === "sd-request-lang" && schema.custom === "com.atlassian.servicedesk.servicedesk-lingo-integration-plugin:sd-request-language") {
      columns.push({ name: column_name + " Code", path: ["fields", id, "languageCode"].join(".") });
      columns.push({ name: column_name + " Name", path: ["fields", id, "displayName"].join(".") });
    } else if (schema.type === "sd-servicelevelagreement" && schema.custom === "com.atlassian.servicedesk:sd-sla-field") {
      columns.push({ name: column_name + ": Elapsed Time", path: ["fields", id, "completedCycles", "elapsedTime", "millis"], aggregate: "sum" });
      columns.push({ name: column_name + ": Goal Duration", path: ["fields", id, "completedCycles", "goalDuration", "millis"], aggregate: "max" });
    } else if (schema.type === "sd-customerrequesttype" && schema.custom === "com.atlassian.servicedesk:vp-origin") {
      columns.push({ name: column_name + ": Current Status", path: ["fields", id, "currentStatus", "status"] });
    } else if (schema.type === "any" && schema.custom === "com.atlassian.jira.ext.charting:timeinstatus" && expand_time_in_status) {
      statuses.forEach(status => {
        columns.push({ name: `${column_name} Count: ${status.name}`, path: ["fields", id, status.name, "count"] });
        columns.push({ name: `${column_name} Duration: ${status.name}`, path: ["fields", id, status.name, "duration"] });
      });
    } else {
      columns.push({ name: column_name, path: "fields." + id });
    }
  }

  if (column_names && column_names.length > 0) {
    if (debug_level >= 3) console.log(`[jira-to-csv] filtering by column names`);
    columns = columns.filter(col => column_names.includes(col.name));

    // if any column names specified that aren't in columns
    const missing_column_names = column_names.filter(name => columns.filter(c => c.name === name).length === 0);
    missing_column_names.forEach(name => {
      columns.push({ name, path: null });
      if (debug_level >= 3) console.log(`[jira-to-csv] adding empty column:`, name);
    });

    // re-sort based on order specified
    columns.sort((a, b) => Math.sign(column_names.indexOf(a.name) - column_names.indexOf(b.name)));
    if (debug_level >= 3) console.log(`[jira-to-csv] sorted columns:`, columns);
  }

  if (debug_level >= 3) console.log(`[jira-to-csv] columns:`, columns);

  const url = domain + "/rest/api/2/search";

  const df = new memsafe.MemSafeTable({
    column_names: columns.map(col => col.name)
  });

  let startAt = offset;
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

    if (typeof max_description_length === "number") {
      response_issues.forEach(issue => {
        if (typeof issue.fields.description === "string" && issue.fields.description.length > max_description_length) {
          issue.fields.description = issue.fields.description.substring(0, max_description_length - 3) + "...";
        }
      });
    }

    // preprocess issues
    response_issues.forEach(response_issue => {
      // sometimes the time in status can be a null string like "null"
      if (expand_time_in_status && time_in_status_field_id && ["null", null, "", undefined].indexOf(response_issue.fields[time_in_status_field_id]) === -1) {
        const time_in_status = response_issue.fields[time_in_status_field_id];
        if (debug_level >= 5) console.log("[jira-to-csv] time_in_status:", time_in_status);
        response_issue.fields[time_in_status_field_id] = Object.fromEntries(
          time_in_status.split("_*|*_").map(it => {
            const [id, count, duration] = it.split("_*:*_");
            if (debug_level >= 5) console.log("[jira-to-csv] id:", id);
            return [status_by_id[id].name, { count: Number(count), duration: Number(duration) }];
          })
        );
      }
    });

    if (debug_level >= 5) {
      console.log("[jira-to-csv] response_issues[0]:", response_issues[0]);
    }

    if (debug_level >= 2) console.log("[jira-to-csv] response_issues.length:", response_issues.length);

    if (i === 0 && response_issues.length === 0) {
      if (debug_level >= 1) console.warn(`[jira-to-csv] no response items. did you forget to authenticate?`);
    }

    if (response_issues.length === 0) break;

    for (let r = 0; r < response_issues.length; r++) {
      const issue = response_issues[r];
      if (typeof max_issues === "number" && max_issues !== Infinity && df.length === max_issues) {
        break;
      }

      // need to convert to save memory
      const row = Object.fromEntries(
        columns.map(col => {
          // if path is null return empty string
          // this can happen when the user asks for a column that doesn't exist (or may have existed previously)
          if (col.path === null) return [col.name, ""];

          let value = sendero.get(issue, col.path, { clean: true, sort: _sort, stringify: true, unique: false });

          if (value.length === 1 && value[0] === "{{issue.reporter.emailAddress}}") {
            const colpath = "fields.reporter.emailAddress";
            const original = value;
            value = sendero.get(issue, colpath, { clean: true, sort: _sort, stringify: true, unique: false });
            if (debug_level >= 2) console.log("[jira-to-csv] replaced", original, "with", value);
          }

          if (col.aggregate === "sum") {
            value = value.reduce((acc, it) => acc + Number(it), 0).toString();
          } else if (col.aggregate === "max" && value.length > 1) {
            value = Math.max(...value.map(v => Number(v))).toString();
          } else {
            value = value.join(subdelimiter);
          }
          if (remove_new_lines) value = value.replace(/(\n|\r|\n\r|\r\n)/g, " ");
          value = value.trim();
          if (value.includes("EPIC_LINK_SHOULD_BE_USED")) value = "";
          return [col.name, value];
        })
      );

      df.push(row);
    }

    if (typeof max_issues === "number" && max_issues !== Infinity && df.length === max_issues) {
      break;
    }

    startAt += response_issues.length;
  }

  if (debug_level >= 5) console.warn("[jira-to-csv] memory usage:", process.memoryUsage());

  // proactively clean empty columns lowering future memory consumption
  const drop_these_columns = [];
  if (drop_empty_columns) {
    columns.forEach(col => {
      const rle = df._columns.find(it => it[0] === col.name)[1]._data;
      if (rle.length === 2 && [undefined, ""].includes(rle[1])) {
        drop_these_columns.push(col.name);
      }
    });
  }

  if (drop_these_columns.length > 0) {
    columns = columns.filter(col => drop_these_columns.indexOf(col.name) === -1);
    drop_these_columns.forEach(col => {
      df.drop_column(col);
      if (debug_level >= 3) console.log(`[jira-to-csv] dropped empty column "${col}"`);
    });
  }

  const rows = [];
  for (const row of df) {
    rows.push(row);
  }

  const csv = papaparse.unparse(rows, {
    columns: columns.map(col => col.name),
    newline: "\n",
    quotes: true
  });

  if (debug_level >= 3) console.log("[jira-to-csv] csv header:", csv.split("\n")[0].split(","));

  if (debug_level >= 3) {
    console.log("[jira-to-csv] first 500 characters of the csv:", csv.substring(0, 500));
  }

  return { csv };
}

module.exports = {
  export_issues,
  get_fields,
  get_statuses
};
