[![Build Status](https://travis.innovate.ibm.com/BluemixSolutions/hubot-ibmcloud-objectstorage-crawler.svg?token=Gn7Cdz9YEJSDvAVxXAUD&branch=master)](https://travis.innovate.ibm.com/BluemixSolutions/hubot-ibmcloud-objectstorage-crawler)
[![Coverage Status](https://pages.github.ibm.com/BluemixSolutions/hubot-ibmcloud-objectstorage-crawler/coverage/badge.svg)](https://pages.github.ibm.com/BluemixSolutions/hubot-ibmcloud-objectstorage-crawler/coverage/lcov-report/index.html)

# hubot-ibmcloud-objectstorage-crawler

A Hubot script for managing Object Storage containers messages with [IBM Object Storage](https://console.ng.bluemix.net/catalog/services/object-storage/).

## Getting Started
* [Usage](#usage)
* [Commands](#commands)
* [Hubot Adapter Setup](#hubot-adapter-setup)
* [Cognitive Setup](#cognitive-setup)
* [Development](#development)
* [License](#license)
* [Contribute](#contribute)

## Usage

Steps for adding this to your existing hubot:

1. `cd` into your hubot directory
2. Install the Swift Object Storage functionality with `npm install hubot-ibmcloud-objectstorage --save`
3. Add `hubot-ibmcloud-translate` to your `external-scripts.json`
4. Add the necessary environment variables for Object Storage
```
export HUBOT_OBJECT_STORAGE_AUTH_URL=<URL>
export HUBOT_OBJECT_STORAGE_USER_ID=<USER_ID>
export HUBOT_OBJECT_STORAGE_PASSWORD=<PASSWORD>
export HUBOT_OBJECT_STORAGE_PROJECT_ID=<PROJECT_ID>
export HUBOT_OBJECT_STORAGE_BLUEMIX_REGION=dallas
```
5. If you would like to enable NLC search, you will need to configure the following NLC variables:
```
export HUBOT_WATSON_NLC_URL=<NLC_URL>
export HUBOT_WATSON_NLC_USERNAME=<NLC_USERNAME>
export HUBOT_WATSON_NLC_PASSWORD=<NLC_PASSWORD>
```

6. The search feature also has a few additional variables that can be set.  Each has a default value if unset.
    - `HUBOT_OBJECT_STORAGE_SEARCH_CLASSIFIER_NAME` - determines what classifier name is used.  
    - `HUBOT_OBJECT_STORAGE_SEARCH_CONFIDENCE_MIN` - determines the minimum confidence level for a Watson classify call.  The number should be a float less than 1 and greater than 0.  Default value is `0.25`.  Classify results that are less than this threshold will be filtered out of the results.
    - `HUBOT_OBJECT_STORAGE_SEARCH_RESULT_LIMIT` - limits the number of results returned from search.  Currently it defaults to 3 results.  
    - `HUBOT_OBJECT_STORAGE_CLASSIFIER_CLEANUP_INTERVAL` - determines how frequently old classifiers are automatically cleaned up.

```
export HUBOT_OBJECT_STORAGE_SEARCH_CLASSIFIER_NAME=<classiferName>
export HUBOT_OBJECT_STORAGE_SEARCH_CONFIDENCE_MIN=<confidenceLevel>
export HUBOT_OBJECT_STORAGE_SEARCH_RESULT_LIMIT=<searchResultLimit>
export HUBOT_OBJECT_STORAGE_CLASSIFIER_CLEANUP_INTERVAL=<cleanupInterval>
```

7. Start up your bot & off to the races!

## Commands
- `hubot objectstorage help` - Show available commands in the ibmcloud objectstorage category.
- `hubot objectstorage container list` - Show all Object Storage containers
- `hubot objectstorage container details <container>` - Lists the objects inside of <container> object storage container.  <container> is optional.  If omitted, you can select a container from a list.
- `hubot objectstorage retrieve <container> <object>` - Retrieves <object> object found in the container <container>.  Both <container> and <object> are optional.  If omitted, you will be prompted to select them.
- `hubot objectstorage search <searchPhrase>` - Search Object Storage for <searchPhrase>.  Objects matching the <searchPhrase> will be returned to the adapter.

## Hubot Adapter Setup

Hubot supports a variety of adapters to connect to popular chat clients.  For more feature rich experiences you can setup the following adapters:
- [Slack setup](https://github.com/ibm-cloud-solutions/hubot-ibmcloud-objectstorage/blob/master/docs/adapters/slack.md)
- [Facebook Messenger setup](https://github.com/ibm-cloud-solutions/hubot-ibmcloud-objectstorage/blob/master/docs/adapters/facebook.md)

## Cognitive Setup

This project supports natural language interactions using Watson and other Bluemix services.  For more information on enabling these features, refer to [Cognitive Setup](https://github.com/ibm-cloud-solutions/hubot-ibmcloud-nlc/blob/master/docs/cognitiveSetup.md).

## Development

Please refer to the [CONTRIBUTING.md](https://github.com/ibm-cloud-solutions/hubot-ibmcloud-objectstorage/blob/master/CONTRIBUTING.md) before starting any work.  Steps for running this script for development purposes:

### Configuration Setup

1. Create `config` folder in root of this project.
2. Create `env` in the `config` folder, with the following contents:
```
export HUBOT_OBJECT_STORAGE_AUTH_URL=<URL>
export HUBOT_OBJECT_STORAGE_USER_ID=<USER_ID>
export HUBOT_OBJECT_STORAGE_PASSWORD=<PASSWORD>
export HUBOT_OBJECT_STORAGE_PROJECT_ID=<PROJECT_ID>
export HUBOT_OBJECT_STORAGE_BLUEMIX_REGION=dallas
```
3. In order to view content in chat clients you will need to add `hubot-ibmcloud-formatter` to your `external-scripts.json` file. Additionally, if you want to use `hubot-help` to make sure your command documentation is correct. Create `external-scripts.json` in the root of this project, with the following contents:
```
[
    "hubot-help",
    "hubot-ibmcloud-formatter"
]
```
4. Lastly, run `npm install` to obtain all the dependent node modules.

### Running Hubot with adapters

Hubot supports a variety of adapters to connect to popular chat clients.

If you just want to use:
 - Terminal: run `npm run start`
 - [Slack: link to setup instructions](https://github.com/ibm-cloud-solutions/hubot-ibmcloud-objectstorage/blob/master/docs/adapters/slack.md)
 - [Facebook Messenger: link to setup instructions](https://github.com/ibm-cloud-solutions/hubot-ibmcloud-objectstorage/blob/master/docs/adapters/facebook.md)

## License

See [LICENSE.txt](https://github.com/ibm-cloud-solutions/hubot-ibmcloud-objectstorage/blob/master/LICENSE.txt) for license information.

## Contribute

Please check out our [Contribution Guidelines](https://github.com/ibm-cloud-solutions/hubot-ibmcloud-objectstorage/blob/master/CONTRIBUTING.md) for detailed information on how you can lend a hand.
