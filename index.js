const fs = require('fs');
const readline = require('readline');
const { google } = require('googleapis');
require('dotenv').config();

// If modifying these scopes, delete token.json.
const SCOPES = ['https://www.googleapis.com/auth/script.projects',
  'https://www.googleapis.com/auth/script.deployments',
  'https://www.googleapis.com/auth/spreadsheets.currentonly',
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/forms',
  'https://www.googleapis.com/auth/forms.currentonly'];
// The file token.json stores the user's access and refresh tokens, and is
// created automatically when the authorization flow completes for the first
// time.
const TOKEN_PATH = 'token.json';

// Load client secrets from a local file.
fs.readFile('credentials.json', (err, content) => {
  if (err) return console.log('Error loading client secret file:', err);
  // Authorize a client with credentials, then call the Google Apps Script API.
  // authorize(JSON.parse(content), callAppsScript);
  authorize(JSON.parse(content), callAppsScript);

});

/**
 * Create an OAuth2 client with the given credentials, and then execute the
 * given callback function.
 * @param {Object} credentials The authorization client credentials.
 * @param {function} callback The callback to call with the authorized client.
 */
function authorize(credentials, callback) {
  const { client_secret, client_id, redirect_uris } = credentials.installed;
  const oAuth2Client = new google.auth.OAuth2(
    client_id, client_secret, redirect_uris[0]);

  // Check if we have previously stored a token.
  fs.readFile(TOKEN_PATH, (err, token) => {
    if (err) return getAccessToken(oAuth2Client, callback);
    oAuth2Client.setCredentials(JSON.parse(token));
    callback(oAuth2Client);
  });
}

/**
 * Get and store new token after prompting for user authorization, and then
 * execute the given callback with the authorized OAuth2 client.
 * @param {google.auth.OAuth2} oAuth2Client The OAuth2 client to get token for.
 * @param {getEventsCallback} callback The callback for the authorized client.
 */
function getAccessToken(oAuth2Client, callback) {
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
  });
  console.log('Authorize this app by visiting this url:', authUrl);
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  rl.question('Enter the code from that page here: ', (code) => {
    rl.close();
    oAuth2Client.getToken(code, (err, token) => {
      if (err) return console.error('Error retrieving access token', err);
      oAuth2Client.setCredentials(token);
      // Store the token to disk for later program executions
      fs.writeFile(TOKEN_PATH, JSON.stringify(token), (err) => {
        if (err) return console.error(err);
        console.log('Token stored to', TOKEN_PATH);
      });
      callback(oAuth2Client);
    });
  });
}

/**
 * Creates a new script project, upload a file, and log the script's URL.
 * @param {google.auth.OAuth2} auth An authorized OAuth2 client.
 */
function callAppsScript(auth) {

  const script = google.script({ version: 'v1', auth });
  const scriptId = process.env.SCRIPT_ID;
  const deploymentId = process.env.DEPLOYMENT_ID;

  console.log(scriptId);
  script.projects.updateContent({
    scriptId: scriptId,
    auth,
    resource: {
      files: [{
        name: 'hello',
        type: 'SERVER_JS',
        source: 'function myFunction() {\n var form = FormApp.create(\'New Form\');\n var item = form.addTextItem();\n item.setTitle(\'Shortcode\');\n  var sheet = SpreadsheetApp.create("Responses", 50, 5); \n sheet.addEditor("sa-eventmanager@event-manager-cl-1597328691488.iam.gserviceaccount.com");\n form.setDestination(FormApp.DestinationType.SPREADSHEET, sheet.getId()); \n Logger.log(\'Published URL: \' + form.getPublishedUrl());\n Logger.log(\'Editor URL: \' + form.getEditUrl());\n   var res = {\'formResLink\' : form.getPublishedUrl(), \'formEditLink\' : form .getEditUrl(), \'sheetId\' : sheet.getId() }; \n return res;\n }',
      }, {
        name: 'appsscript',
        type: 'JSON',
        source: '{\"timeZone\":\"America/New_York\","executionApi": {"access": "ANYONE"},\"exceptionLogging\":' +
          '\"CLOUD\"}',
      }],
    },
  }, {}, (err, res) => {
    if (err) return console.log(`The API updateContent method returned an error: ${err}`);
    console.log('content updated')
    console.log(`https://script.google.com/d/${res.data.scriptId}/edit`);

    script.projects.versions.create({
      scriptId: scriptId,
      auth: auth,
      resource: {
        versionNumber: 1,
      }
    }, {}, (err, res) => {
      console.log(scriptId);
      console.log('this' + res.data.versionNumber);


      if (err) {
        // The API encountered a problem before the script started executing.
        return console.log('The API version create returned an error: ' + err);
      }
      console.log('version create success');
      // script.projects.deployments.create({
      //   scriptId: scriptId,
      //   auth: auth,
      //   resource: {
      //     versionNumber: res.data.versionNumber,
      //   }
      // }, {}, (err, res) => {

      script.projects.deployments.update({
        scriptId: scriptId,
        deploymentId: deploymentId,
        auth: auth,
        resource: {
          "deploymentConfig": {
            "versionNumber": res.data.versionNumber,
          }
        }
      }, {}, (err, res) => {


        if (err) {
          // The API encountered a problem before the script started executing.
          return console.log('The API deployments create returned an error: ' + err);
        }
        console.log('deployment success');
        console.log(res.data.deploymentId)
        console.log(res.data.deploymentConfig)
        console.log(res.data.deploymentConfig.scriptId)


        script.scripts.run({
          scriptId: scriptId,
          auth,
          resource: {
            function: 'myFunction',
            devMode: true,
          },
        }, {}, (err, res) => {


          if (err) {
            // The API encountered a problem before the script started executing.
            return console.log('The API scripts run returned an error: ' + err);
          }
          console.log(res.data.response.result);
          // saveItemInFolder(res.data.response.result.SHEET_ID)
          console.log('success');
        });
      });
    });
  });
}


// using google sheets api

const spreadsheetId = process.env.SHEET_ID
function readSheet(auth) {
  const sheets = google.sheets({ version: 'v4', auth });
  sheets.spreadsheets.values.get({
    spreadsheetId: spreadsheetId,
    range: 'A1:B4',
  }, (err, res) => {
    if (err) return console.log('The API returned an error: ' + err);
    const rows = res.data.values;
    if (rows.length) {
      // Print columns A and B, which correspond to indices 0 and 1.
      rows.map((row) => {
        console.log(`${row[0]}, ${row[1]}`);
      });
    } else {
      console.log('No data found.');
    }
  });
}

//using npm google-sheets
async function read() {
  const { GoogleSpreadsheet } = require('google-spreadsheet');

  // spreadsheet key is the long id in the sheets URL
  const doc = new GoogleSpreadsheet('1hBVGgEA8G_8rHXZ165mWRtDcnPrkuRPyrWHk__Y1ThQ');

  // OR load directly from json file if not in secure environment
  await doc.useServiceAccountAuth(require('./sa-credentials.json'));
  // OR use API key -- only for read-only access to public sheets
  // doc.useApiKey('YOUR-API-KEY');

  await doc.loadInfo(); // loads document properties and worksheets
  console.log(doc.title);
  // await doc.updateProperties({ title: 'renamed doc' });

  const sheet = doc.sheetsByIndex[0]; // or use doc.sheetsById[id]
  console.log(sheet.title);
  console.log(sheet.rowCount);
  // read cells
  await sheet.loadCells('A1:B4');

  // read/write cell values
  const a1 = sheet.getCell(0, 0); // access cells using a zero-based index
  const b2 = sheet.getCellByA1('B2'); // or A1 style notation
  // access everything about the cell
  console.log(a1.value);
  console.log(a1.formula);
  console.log(a1.formattedValue);
  console.log(b2.value)


}
