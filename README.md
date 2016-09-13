[![Build Status](https://travis-ci.org/ibm-cloud-solutions/hubot-ibmcloud-objectstorage-crawler.svg?branch=master)](https://travis-ci.org/ibm-cloud-solutions/hubot-ibmcloud-objectstorage-crawler)
[![Coverage Status](https://coveralls.io/repos/github/ibm-cloud-solutions/hubot-ibmcloud-objectstorage-crawler/badge.svg?branch=master)](https://coveralls.io/github/ibm-cloud-solutions/hubot-ibmcloud-objectstorage-crawler?branch=master)
[![Dependency Status](https://dependencyci.com/github/ibm-cloud-solutions/hubot-ibmcloud-objectstorage-crawler/badge)](https://dependencyci.com/github/ibm-cloud-solutions/hubot-ibmcloud-objectstorage-crawler)
[![npm](https://img.shields.io/npm/v/hubot-ibmcloud-objectstorage-crawler.svg?maxAge=2592000)](https://www.npmjs.com/package/hubot-ibmcloud-objectstorage-crawler)

# hubot-ibmcloud-objectstorage-crawler

A Node script that indexes Object Storage containers enabling a cognitive search.  See the [IBM Object Storage Service](https://console.ng.bluemix.net/catalog/services/object-storage/) for more information.

## Getting Started
* [Usage](#usage)
* [Commands](#commands)
* [Cognitive Setup](#cognitive-setup)
* [Development](#development)
* [License](#license)
* [Contribute](#contribute)

## Usage

Steps for adding this to your existing hubot:

1. Run `git clone https://github.com/ibm-cloud-solutions/hubot-ibmcloud-objectstorage-crawler`
2. Run `cd hubot-ibmcloud-objectstorage-crawler`
3. Run `npm install`
4. Add the necessary environment variables for Object Storage, Watson Natural Language Classifier, Watson Visual Recognition, Watson Document Conversion, and Alchemy Language Services.

```
# Object Storage configuration
export HUBOT_OBJECT_STORAGE_AUTH_URL=<URL>
export HUBOT_OBJECT_STORAGE_USER_ID=<USER_ID>
export HUBOT_OBJECT_STORAGE_PASSWORD=<PASSWORD>
export HUBOT_OBJECT_STORAGE_PROJECT_ID=<PROJECT_ID>
export HUBOT_OBJECT_STORAGE_BLUEMIX_REGION=dallas

# Watson Natural Language Classifier configuration
export HUBOT_WATSON_NLC_URL=<NLC_URL>
export HUBOT_WATSON_NLC_USERNAME=<NLC_USERNAME>
export HUBOT_WATSON_NLC_PASSWORD=<NLC_PASSWORD>

# Watson Visual Recognition configuration
export HUBOT_VISUAL_RECOGNITION_API_KEY=<API_KEY>
export HUBOT_VISUAL_RECOGNITION_VERSION_DATE="2016-05-20"

# Watson Document Conversion configuration
export HUBOT_DOC_CONVERSION_USERNAME=<USERNAME>
export HUBOT_DOC_CONVERSION_PASSWORD=<PASSWORD>
export HUBOT_DOC_CONVERSION_VERSION_DATE=2015-12-15

# Alchemy Language configuration
export HUBOT_ALCHEMY_API_KEY=<API_KEY>
```

## Development

Please refer to the [CONTRIBUTING.md](https://github.com/ibm-cloud-solutions/hubot-ibmcloud-objectstorage-crawler/blob/master/CONTRIBUTING.md) before starting any work.  Steps for running this script for development purposes:

### Configuration Setup to run Locally
1. Create `config` folder in root of this project.
2. Create `env` in the `config` folder
3. Add the environment variables described above to the env file.

### Running Locally
- Run `npm run start` start the app that allows you to scan and index object storage
- Run `npm run test` to run automated tests

## License

See [LICENSE.txt](https://github.com/ibm-cloud-solutions/hubot-ibmcloud-objectstorage-crawler/blob/master/LICENSE.txt) for license information.

## Contribute

Please check out our [Contribution Guidelines](https://github.com/ibm-cloud-solutions/hubot-ibmcloud-objectstorage-crawler/blob/master/CONTRIBUTING.md) for detailed information on how you can lend a hand.
