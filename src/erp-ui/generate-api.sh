#!/bin/bash

# download the latest swagger definition file
curl -o swagger.json http://localhost:5200/openapi/v1.json
# remove the existing api folder
npx rimraf projects/api/src/lib
# generate the api client
npx openapi-generator-cli generate --generator-key=fs-erp-api
# delete the swagger definition file
rm ./swagger.json

#java -jar "C:\Users\flolu\Documents\Workspace\Privat\fachschaften-erp\src\erp-ui\node_modules\@openapitools\openapi-generator-cli\versions\7.4.0.jar" generate --input-spec="file:///C:/Users/flolu/Documents/Workspace/Privat/fachschaften-erp/src/erp-ui/swagger.json" --generator-name="typescript-angular" --output="projects/api/src/lib" --additional-properties="apiModulePrefix=FS-ERP,withInterfaces=true,fileNaming=kebab-case,useSingleRequestParameter=true,supportsES6=true,stringEnums=true"
