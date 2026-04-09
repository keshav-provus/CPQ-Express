const https = require('https');
const { execSync } = require('child_process');

// Get session ID
const token = execSync('/usr/local/bin/sfdx org display -p --json | jq -r .result.accessToken').toString().trim();
const urlStr = execSync('/usr/local/bin/sfdx org display -p --json | jq -r .result.instanceUrl').toString().trim();

const data = JSON.stringify({
  apiName: 'CurrencyType',
  fields: {
    IsoCode: 'AUD',
    ConversionRate: 1.5,
    IsActive: true,
    DecimalPlaces: 2
  }
});

const url = new URL(`${urlStr}/services/data/v60.0/ui-api/records`);

const req = https.request(url, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
}, (res) => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => console.log(body));
});
req.write(data);
req.end();
