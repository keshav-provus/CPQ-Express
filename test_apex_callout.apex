String sessionId = UserInfo.getSessionId();
String orgDomain = Url.getOrgDomainUrl().toExternalForm();

Http http = new Http();
HttpRequest request = new HttpRequest();
request.setEndpoint(orgDomain + '/services/data/v60.0/sobjects/CurrencyType/');
request.setMethod('POST');
request.setHeader('Authorization', 'Bearer ' + sessionId);
request.setHeader('Content-Type', 'application/json');
request.setBody('{"IsoCode":"NZD","ConversionRate":1.6,"IsActive":true,"DecimalPlaces":2}');

HttpResponse response = http.send(request);
System.debug('Response Code: ' + response.getStatusCode());
System.debug('Response Body: ' + response.getBody());
