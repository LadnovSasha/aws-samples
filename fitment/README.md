# Fitment Lambda
This is a basic application that can be provided by serverless framework.
Should be used as a key framework for new one.

## Requirements
To run it locally you need to have:

* [nodejs](https://nodejs.org/uk/download/) (version >= 10.x)
* [npm](https://nodejs.org/uk/download/package-manager/#debian-and-ubuntu-based-linux-distributions) (version >= 6.0) - Usually a part of nodejs

## Installation
```bash
npm install
```

## Development
As we are using serverless framework we are able to start lambdas locally. In this case you need to execute following commad:
```bash
npm run start
```
This will start serverless-offline that will be available on http://localhost:3000

## Endpoints
[/health/status](http://localhost:3000/health/status) - Health endpoint that return state of this lambda.

## Deployment
There is 2 features that allow as to deploy our lambda.

### Package
To create a package without deploying it to AWS you can use following command:
```bash
npm run package
```
after executing this command serverless will build lambda and create all deployment data into **.serverless**  folder.
### Deploy
To build and deploy lambda you need to save your AWS credentials to **~/.aws/credentials file**:

```bash
serverless config credentials --provider aws --key YOUR_ACCESS_KEY --secret YOUR_SECRET_KEY
```

After that you can simple deploy it with:
```bash
npm run deploy
```

## Build
There is two ways to build this module:
To build it for development purpose use:
```bash
npm run build
```
The second is **postinstall** script that build it after module have been install as a dependency of other package.
## Testing
Lint test:
```bash
npm run lint
```
Unit test:
```bash
npm run test
```

CI test 2
