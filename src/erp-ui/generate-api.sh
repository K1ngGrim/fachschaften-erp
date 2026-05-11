#!/bin/bash

# download the latest swagger definition file
curl -o swagger.json http://localhost:5000/openapi/v1.json
# remove the existing api folder
npx rimraf projects/api/src/lib
# generate the api client
npx openapi-generator-cli generate --generator-key=fs-erp-api
# delete the swagger definition file
rm ./swagger.json
