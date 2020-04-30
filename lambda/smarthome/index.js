// -*- coding: utf-8 -*-

// Copyright 2020 Amazon.com, Inc. or its affiliates. All Rights Reserved.

// Licensed under the Amazon Software License (the "License"). You may not use this file except in
// compliance with the License. A copy of the License is located at

//    http://aws.amazon.com/asl/

// or in the "license" file accompanying this file. This file is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, express or implied. See the License for the specific
// language governing permissions and limitations under the License.

'use strict';
var AWS = require('aws-sdk');
const axios = require('axios');
const AlexaResponse = require("./AlexaResponse");
const credentials = require("./credentials");

exports.handler = async function (event, context) {
    // Dump the request for logging - check the CloudWatch logs
    console.log("----- index.handler request  -----");
    console.log(JSON.stringify(event));
    // Dump the context for logging - check the CloudWatch logs
    if (context !== undefined) {
        console.log("----- index.handler context  -----");
        console.log(JSON.stringify(context));
    }
    // Validate we have an Alexa directive
    if (!('directive' in event)) {
        const aer = new AlexaResponse({
            "name": "ErrorResponse",
            "payload": {
                "type": "INVALID_DIRECTIVE",
                "message": "Missing key: directive, Is request a valid Alexa directive?"
            }
        });
        return sendResponse(aer.get());
    }
    // Check the payload version
    if (event.directive.header.payloadVersion !== "3") {
        const aer = new AlexaResponse({
            "name": "ErrorResponse",
            "payload": {
                "type": "INTERNAL_ERROR",
                "message": "This skill only supports Smart Home API version 3"
            }
        });
        return sendResponse(aer.get())
    }
    // Get directive namespace
    const namespace = (((event.directive || {}).header || {}).namespace || {}).toLowerCase();
    let jsonResponse;
    // Manage directives
    switch (namespace) {
        case 'alexa.authorization':
            const acceptGrantCode = event.directive.payload.grant.code;
            await handleAcceptGrant(acceptGrantCode);
            jsonResponse = new AlexaResponse({
                "namespace": "Alexa.Authorization",
                "name": "AcceptGrant.Response"
            }).get();
            break;
        case 'alexa.discovery':
            jsonResponse = handleDiscovery();
            break;
        case 'alexa.rtcsessioncontroller':
            jsonResponse = await handleWebRtc(event);
            break;
        default:
            jsonResponse = new AlexaResponse({
                "name": "ErrorResponse",
                "payload": {
                    "type": "INVALID_DIRECTIVE",
                    "message": namespace + "is NOT a capability handled by the Skill"
                }
            }).get();
            break;
    }
    // Return JSON Response
    return sendResponse(jsonResponse);
};

function sendResponse(response) {
    console.log("----- index.sendResponse -----");
    console.log(JSON.stringify(response));
    return response
}

async function getSDPAnswer(event) {
    console.log("----- index.getSDPAnswer -----");
    // Create KVS Client
    const kinesisVideoClient = new AWS.KinesisVideo({
        region: credentials.kvs.region
    });
    // Get signaling Channel ARN
    const describeSignalingChannelResponse = await kinesisVideoClient
        .describeSignalingChannel({
            ChannelName: credentials.kvs.channel_name
        })
        .promise();
    const channelARN = describeSignalingChannelResponse.ChannelInfo.ChannelARN;
    console.log('[VIEWER] Channel ARN: ', channelARN);
    // Get signaling channel endpoints
    const getSignalingChannelEndpointResponse = await kinesisVideoClient
        .getSignalingChannelEndpoint({
            ChannelARN: credentials.kvs.channel_arn,
            SingleMasterChannelEndpointConfiguration: {
                "Protocols": ["HTTPS",],
                "Role": "VIEWER"
            }
        })
        .promise();
    const endpointsByProtocol = getSignalingChannelEndpointResponse.ResourceEndpointList.reduce((endpoints, endpoint) => {
        endpoints[endpoint.Protocol] = endpoint.ResourceEndpoint;
        return endpoints;
    }, {});
    console.log('[VIEWER] Endpoints: ', endpointsByProtocol);
    // Create KVS Signaling Channel
    const kinesisVideoSignalingChannelsClient = new AWS.KinesisVideoSignalingChannels({
        region: credentials.kvs.region,
        endpoint: endpointsByProtocol.HTTPS
    });
    // Alexa SDP Offer
    const sdpOffer = JSON.stringify({"type": "offer","sdp": event.directive.payload.offer.value});
    // Sent the Alexa SDP offer to Master
    const answerResponse = await kinesisVideoSignalingChannelsClient
        .sendAlexaOfferToMaster({
            ChannelARN: channelARN,
            MessagePayload: Buffer.from(sdpOffer || '').toString('base64'),
            SenderClientId: AlexaResponse.generateEndpointId("viewer")
        })
        .promise();
    // Deccode SDP Answer
    const sdpAnswerAsString = (Buffer.from(answerResponse.Answer || '', 'base64')
        .toString('utf8') || '');
    console.log('[VIEWER] SDP Answer: ' + sdpAnswerAsString);
    const jsonSdpAnswer = JSON.parse(sdpAnswerAsString || "{'sdp': ''}");
    console.log('[VIEWER] Output : ' + jsonSdpAnswer.sdp);
    return jsonSdpAnswer.sdp;
}

function handleDiscovery() {
    console.log("----- index.handleDiscovery -----");
    //create response
    let adr = new AlexaResponse({
        "namespace": "Alexa.Discovery",
        "name": "Discover.Response"
    });
    // commom capability
    let capability_alexa = adr.createPayloadEndpointCapability();
    // webrtc capability
    let capability_alexa_webrtc = adr.createPayloadEndpointCapability({
        "interface": "Alexa.RTCSessionController",
        "configuration": {
            "isFullDuplexAudioSupported": true
        }
    });
    // doorbell capability
    let capability_alexa_doorbell = adr.createPayloadEndpointCapability({
        "interface": "Alexa.DoorbellEventSource",
        "proactivelyReported": true
    });
    // define doorbell appliance
    var friendlyName_EN = "doorbell";
    var friendlyName_FR = "porte d'entrée";
    var friendlyName_ES = "timbre"
    adr.addPayloadEndpoint({
        "friendlyName": friendlyName_EN, // Note: can be renamed in Alexa App after discovery
        "description": "Appliance with Video and Doorbell announcement supported",
        "manufacturerName": "My DoorBell Inc.",
        "endpointId": "video-doorbell-001",
        "displayCategories": ["DOORBELL", "CAMERA"], // Note: Alexa App Icon Category corresponds to first item of this array
        "capabilities": [
            capability_alexa,
            capability_alexa_webrtc,
            capability_alexa_doorbell
        ]
    });
    return adr.get();
}

async function handleAcceptGrant(acceptGrantCode) {
    console.log("----- index.handleAcceptGrant -----");
    // set LWA configuration as JSON Object for request call
    const data = {
        grant_type: credentials.lwa.grant_type,
        code: acceptGrantCode,
        client_id: credentials.lwa.client_id,
        client_secret: credentials.lwa.client_secret
    }
    // Dump the data for logging - check the CloudWatch logs
    console.log("---- index.handleAcceptGrant : axios config -----");
    console.log(data);
    let response = await axios.post(credentials.lwa.token_server, data);
    // Dump the response for logging - check the CloudWatch logs
    console.log("---- index.handleAcceptGrant : response -----");
    console.log(response.data);
}

async function handleWebRtc(event) {
    console.log("----- index.handleWebRtc -----");
    const directive = event.directive.header.name;
    const endpointId = event.directive.endpoint.endpointId;
    const token = event.directive.endpoint.scope.token;
    const correlationToken = event.directive.header.correlationToken;
    const sessionId = event.directive.payload.sessionId;
    let jsonResponse;
    switch (directive) {
        case 'InitiateSessionWithOffer':
            console.log('--- WebRtc | InitiateSessionWithOffer ---');
            // Call Signaling Server
            const sdpAnswer = await getSDPAnswer(event);
            // Generate response with SDP Answer from Signaling Server
            jsonResponse = new AlexaResponse({
                "namespace": "Alexa.RTCSessionController",
                "name": "AnswerGeneratedForSession",
                "correlationToken": correlationToken,
                "token": token,
                "endpointId": endpointId,
                "payload": {
                    "answer": {
                        "format": "SDP",
                        "value": sdpAnswer
                    }
                }
            }).get();
            break;
        case 'SessionConnected':
            console.log('--- WebRtc | SessionConnected ---');
            jsonResponse = new AlexaResponse({
                "namespace": "Alexa.RTCSessionController",
                "name": "SessionConnected",
                "correlationToken": correlationToken,
                "token": token,
                "endpointId": endpointId,
                "payload": {
                    "sessionId": sessionId
                }
            }).get();
            break;
        case 'SessionDisconnected':
            console.log('--- WebRtc | SessionDisconnected ---');
            jsonResponse = new AlexaResponse({
                "namespace": "Alexa.RTCSessionController",
                "name": "SessionDisconnected",
                "correlationToken": correlationToken,
                "token": token,
                "endpointId": endpointId,
                "payload": {
                    "sessionId": sessionId
                }
            }).get();
            break;
        default:
            console.log('--- WebRtc | Default ---');
            jsonResponse = new AlexaResponse({
                "name": "ErrorResponse",
                "payload": {
                    "type": "INVALID_DIRECTIVE",
                    "message": directive + "is NOT a directive handled by the Skill"
                }
            }).get();;
            break;
    }
    return jsonResponse;
}