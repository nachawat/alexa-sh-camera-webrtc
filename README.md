# Alexa SmartHome Camera WebRTC Integration with AWS KVS
This repository showcase how to integrate *Video Doorbells* with Alexa using [WebRTC](https://en.wikipedia.org/wiki/WebRTC). The underlying objective is to exhibit how to achieve a 2-way full duplex communication. This integration will be based on two building blocks:

* an Alexa [SmartHome Skill](https://developer.amazon.com/en-US/docs/alexa/smarthome/understand-the-smart-home-skill-api.html) declaring a video doorbell appliance using two Interfaces : [Alexa.RTCSessionController](https://developer.amazon.com/en-US/docs/alexa/device-apis/alexa-rtcsessioncontroller.html) (for the Camera) and [Alexa.DoorbellEventSource](https://developer.amazon.com/en-US/docs/alexa/device-apis/alexa-doorbelleventsource.html) (for the Doorbell)

* a managed [Signaling Channel](https://docs.aws.amazon.com/kinesisvideostreams-webrtc-dg/latest/devguide/gs-createchannel.html) from [AWS Kinesis Video Stream WebRTC](https://docs.aws.amazon.com/kinesisvideostreams-webrtc-dg/latest/devguide/what-is-kvswebrtc.html) 

--- 

# Prerequisites

* [Amazon Developer Account](https://developer.amazon.com/)
* [AWS Account](https://portal.aws.amazon.com/billing/signup#/start)
* [AWS IAM Profile/User](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_users_create.html#id_users_create_console)
* [Node.js / NPM](https://nodejs.org/en/download/)
* a computer with webcam
* an Amazon Echo device (a multimodal device is preferred)

---

# Build

## Step 1 : Create a Signaling Channel

Your first step is to create a Signaling Channel on your AWS Account through the Kineses Video Stream service. You can use the [Kinesis Video Streams console](https://docs.aws.amazon.com/kinesisvideostreams-webrtc-dg/latest/devguide/gs-createchannel.html), the [AWS APIs](https://docs.aws.amazon.com/kinesisvideostreams/latest/dg/API_CreateSignalingChannel.html), or the [AWS CLI](https://docs.aws.amazon.com/cli/latest/reference/kinesisvideo/create-signaling-channel.html) to create your signaling channels.

---

## Step 2 : Create an Alexa SmartHome Skill

All necessary steps to build a Smart Home Skill are explained in details in the [Documentation](https://developer.amazon.com/en-US/docs/alexa/smarthome/steps-to-build-a-smart-home-skill.html#create-a-lambda-function). You just need to follow them. 

However, here are a few points of attention:

* **Account Linking:** 

    * We are using Login with Amazon (LWA) in this sample for demo purposes. You need to create a security profile from the [LWA Section of Developer Portal](https://developer.amazon.com/loginwithamazon/console/site/lwa/overview.html). 

    * Account Linking Information for LWA: 

        * For `Authorization URI` field use https://www.amazon.com/ap/oa
        * For `Access Token URI` field use https://api.amazon.com/auth/o2/token
        * For `Client ID` field use value for LWA Security Profile
        * For `Your Secret` field use value from LWA Security Profile

    * You shall whitelist the `Alexa Redirect URLs` listed on the Account Linking page in your OAUTH service. Typically, for LWA, it means going back in the [LWA Section of the Developer Portal](https://developer.amazon.com/loginwithamazon/console/site/lwa/overview.html), select your `Security Profile`, go to the `Web Settings` and update the `Allowed Return URLs` by clicking the `Edit` button. You should have 3 URLs to add and they shall look like the following ones:
```
https://pitangui.amazon.com/api/skill/link/<_YOUR_VENDOR_ID_>
https://layla.amazon.com/api/skill/link/<_YOUR_VENDOR_ID_>
https://alexa.amazon.co.jp/api/skill/link/<_YOUR_VENDOR_ID_>
```
*(Path: Developer Portal > Settings > Security Profiles > Select Profile > Web Settings > Edit > Allowed Return URLs)*

* **AWS Lambda**

    * Make sure you use the same AWS Account for both the KVS Signaling Channel and Lambda function

    * Alexa requires developers to create AWS Lambda functions in specific regions for supporting specific locales ([`more info here`](https://developer.amazon.com/en-US/docs/alexa/smarthome/develop-smart-home-skills-in-multiple-languages.html#deploy)).

    * To use the codebase available in this repository create a Lambda function with *Runtime* ===*`Node.js 10.x`*. Before uploading the code into the lambda function, the following operations shall be performed:

        * Update [`./lambda/smarthome/credentials.js`](./lambda/smarthome/credentials) with your own Login With Amazon Security Profile keys and AWS KVS Signaling Channel name & arn

        * In directory [`./lambda/smarthome`](./lambda/smarthome) and from the command-line, run the following command to install the dependencies: `npm install`
        
        * Zip the contents of the [`./lambda/smarthome`](./lambda/smarthome) directory into a file named `package.zip`

        * Upload `package.zip` into your Lambda function from the AWS Console

        * **Note:** On the Lambda Configuration Page, be sure to set the function `timeout` to `6 seconds` to avoid any potential timeout while generating the SDP answer *(Path: Lambda > Function > _My_Function_ > Configuration > Basic Settings >  Timeout)*.

    * Add below inline policy in your Lambda **IAM Execution Role** to get access to your AWS KVS Signaling Channel from your code:

    ```json
    {
        "Version": "2012-10-17",
        "Statement": [
            {
                "Sid": "VisualEditor0",
                "Effect": "Allow",
                "Action": [
                    "kinesisvideo:DescribeSignalingChannel",
                    "kinesisvideo:GetSignalingChannelEndpoint",
                    "kinesisvideo:SendAlexaOfferToMaster"
                ],
                "Resource": "*"
            }
        ]
    }
    ``` 

* **Skill Activation**: 

    * To ease testing, I recommend you using the same Amazon account for both your Developer account and your Alexa account. *Reason:* a `development` skill appears automatically on your Alexa account (same Amazon account) and can be easily activated.

    * Once the appliance is discovered, on the Alexa App, go to the appliance details page and activate *"doorbell announcement"*. **Note:** to avoid sending the announcement to all your devices, make sure you select only one device for announcement trigger (a multimodal device is preferred, e.g Echo Show). 

---

## Step 3 : Update Credentials to connect to AWS KVS Signaling Channel

To connect your computer's camera to your newly created Signaling Channel on AWS, you need to update the following credentials in file [`./camera/kvs_webrtc.js`](./camera/kvs_webrtc.js):

```javascript
// AWS Credentials
const AWS_ACCESS_KEY_ID = '_TODO_ADD_YOUR_OWN_';
const AWS_SECRET_ACCESS_KEY = '_TODO_ADD_YOUR_OWN_';
// AWS region
const AWS_REGION = '_TODO_ADD_YOUR_OWN_';
// AWS KVS Signaling Service (Channel)
const AWS_CHANNEL_ARN = '_TODO_ADD_YOUR_OWN_';
```

---

# Test

If you are at this step, it means you have already:

* Created an AWS KVS Signaling Channel
* Deployed an Alexa SmartHome Skill
* Enabled the skill on your Alexa account 

---

## Test Camera Streaming

1. Open file [`./camera/camera_demo.html`](./camera/camera_demo.html)
    * Click on "Start Camera" button
    * Accept to share your camera & microphone 

2. Try the following utterances on your Echo Show device and observe the behavior:   

| Utterance | Alexa Device Component | Flux Duplex Camera | Half Duplex Camera  | No Duplex Camera |
| ------------- |:-------------:|:-----:|:-------------:|:-----:|
| "Alexa, show me the doorbell" | Microphone | Disabled | Disabled | N/A
| "Alexa, show me the doorbell" | Screen | Launch camera feed with talk icon **disabled**. Can **tap** to talk | Launch camera feed with talk icon **disabled**. Can **push** to talk, **release** to stop | Launch Camera feed with no talk button
| 
| "Alexa, talk to the doorbell" | Microphone | Enabled | Disabled | N/A
| "Alexa, talk to the doorbell" | Screen | Launch camera feed with talk icon **enabled**. Can **tap** to stop talking | Launch camera feed with talk icon **disabled**. Can **push** to talk, **release** to stop | Launch Camera feed with no talk button

> **Note** The property `isFullDuplexAudioSupported` on `Alexa.RTCSessionController` determines whether a camera is full duplex or half duplex. In this sample, the camera is full duplex by default. Have a look at the [documentation](https://developer.amazon.com/en-US/docs/alexa/device-apis/alexa-rtcsessioncontroller.html#discovery) to have more details about the `Discovery` response for a WebRTC Camera.

---

## Test Doorbell Announcement

1. Open file [`./camera/camera_demo.html`](./camera/camera_demo.html)
    * Click on "Start Camera" button
    * Accept to share your camera & microphone 

1. Open file [`./camera/doorbell_announcement.html`](./camera/doorbell_announcement.html)
    * Select the region corresponding to the end-user (an US Alexa user would use North America endpoint, a French Alexa User would use Europe endpoint)
    * Enter the `endpointId` use at discovery time
    * Enter the `access token` retrieved from LWA following an `Alexa.Authorization.AcceptGrant` directive
    * Click `Press Doorbell`

> **Note:** If the `acces token` is expired (a LWA token is typically valid for one hour), you can use the second form available to renew the `access token`. Be sure to store the `refresh token` as it will **not** be available afterwards. In a test environnement, if you loose the `refresh token`, you shall re-perform Account Linking (unlink/link skill) and rediscover devices.

3. You should observe the Camera Live Streaming on your Echo Show device. The microphone is disabled.

> **Note:** Following a doorbell pressed event, the automatic live streaming visible on selected Echo Show devices will last 15 seconds max. If you do touch the screen or enable microphone, the streaming session timeout on Alexa side will be 10 minutes.

---

# Resources

[]()

**Kinesis Video Stream WebRTC**

* [Documentation](https://docs.aws.amazon.com/kinesisvideostreams-webrtc-dg/latest/devguide/what-is-kvswebrtc.html)

* [FAQ](https://aws.amazon.com/fr/kinesis/video-streams/faqs/?nc=sn&loc=5#Low-latency_two-way_media_streaming_with_WebRTC)

* Official Github : [JS](https://github.com/awslabs/amazon-kinesis-video-streams-webrtc-sdk-js) | [C](https://github.com/awslabs/amazon-kinesis-video-streams-webrtc-sdk-c) | [Android](https://github.com/awslabs/amazon-kinesis-video-streams-webrtc-sdk-android) | [iOS](https://github.com/awslabs/amazon-kinesis-video-streams-webrtc-sdk-ios)

**Alexa Smart Home Skills**

* [Intro](https://developer.amazon.com/en-US/docs/alexa/smarthome/understand-the-smart-home-skill-api.html)
* [Steps to Build a Smart Home Skill](https://developer.amazon.com/en-US/docs/alexa/smarthome/steps-to-build-a-smart-home-skill.html)
* [Alexa Account Linking](https://developer.amazon.com/en-US/docs/alexa/account-linking/understand-account-linking.html)
* [Login with Amazon](https://login.amazon.com/)
* [Alexa WebRTC Controller](https://developer.amazon.com/en-US/docs/alexa/device-apis/alexa-rtcsessioncontroller.html)
* [Alexa Doorbell Controller](https://developer.amazon.com/en-US/docs/alexa/device-apis/alexa-doorbelleventsource.html)
* [Send Events to Alexa Gateway](https://developer.amazon.com/en-US/docs/alexa/smarthome/send-events-to-the-alexa-event-gateway.html)
* [Alexa SmartHome Developers Forums](https://forums.developer.amazon.com/spaces/33/index.html)
* [Alexa Github](https://github.com/alexa)
* Alexa Blogs: [SmartHome](https://developer.amazon.com/en-US/blogs/alexa/tag.smart-home) | [Alexa Skill Kit](https://developer.amazon.com/en-US/blogs/alexa/alexa-skills-kit) | [Device Makers](https://developer.amazon.com/en-US/blogs/alexa/device-makers)

--- 

# License

This library is licensed under the Amazon Software License