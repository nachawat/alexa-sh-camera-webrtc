// -*- coding: utf-8 -*-

// Copyright 2020 Amazon.com, Inc. or its affiliates. All Rights Reserved.

// Licensed under the Amazon Software License (the "License"). You may not use this file except in
// compliance with the License. A copy of the License is located at

//    http://aws.amazon.com/asl/

// or in the "license" file accompanying this file. This file is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, express or implied. See the License for the specific
// language governing permissions and limitations under the License.

'use strict';

////////////////////////////////////////
// CONSTANTS
////////////////////////////////////////
// Login with Amazon (LWA) token server
const LWA_TOKEN_SERVER = 'https://api.amazon.com/auth/o2/token';
// Alexa Gateway to receive Proactive State Update for North America Users 
const ALEXA_EVENT_GATEWAY_NA = 'https://api.amazonalexa.com/v3/events';
// Alexa Gateway to receive Proactive State Update for Europe Users 
const ALEXA_EVENT_GATEWAY_EU = 'https://api.eu.amazonalexa.com/v3/events';
// Alexa Gateway to receive Proactive State Update for Far East Users 
const ALEXA_EVENT_GATEWAY_FE = 'https://api.fe.amazonalexa.com/v3/events';
////////////////////////////////////////
// COMMON
////////////////////////////////////////
/**
 * Append a given text as a new div into the given parent div
 * 
 * @param {*} divId the parent div id
 * @param {*} level the type of text
 * @param {*} text the text to display
 */
function appendToDiv(divId, level, text) {
    console.log(' --- appendToDiv ---');
    var node = document.createElement("div");
    var nodeContent = `[${new Date().toISOString()}] [${level}] ${text}`;
    node.appendChild(document.createTextNode(nodeContent));
    document.getElementById(divId).appendChild(node);
}
/**
 * Get the HTTP Headers needed to forge an HTTP request to the Alexa Events Gateway
 * 
 * @param {*} token the LWA bearer token
 */
function getHeaders(token) {
    console.log(' --- getHeaders ---');
    var returnValue = {
        headers: {
            'Content-Type': 'application/json'
        }
    }
    if (token !== undefined) {
        returnValue.Authorizaton = `Bearer ${token}`;
    }
    return returnValue;
}
////////////////////////////////////////
// DOORBELL PRESSED SPECIFIC
////////////////////////////////////////
/**
 * Generate an UUID
 */
function uuidv4() {
    console.log(' --- uuidv4 ---');
    return (`${1e7}-${1e3}-${4e3}-${8e3}-${1e11}`).replace(/[018]/g, c =>
        (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
    );
}
/**
 * Get a doorbell pressed event in JSON format for a given device identifier
 * 
 * @param {*} token the LWA bearer token
 * @param {*} endpointId the id of the appliance on Alexa
 */
function getDoorbellPressData(token, endpointId) {
    console.log(' --- getDoorbellPressData ---');
    return {
        "context": {},
        "event": {
            "header": {
                "messageId": uuidv4(),
                "namespace": "Alexa.DoorbellEventSource",
                "name": "DoorbellPress",
                "payloadVersion": "3"
            },
            "endpoint": {
                "scope": {
                    "type": "BearerToken",
                    "token": token
                },
                "endpointId": endpointId
            },
            "payload": {
                "cause": {
                    "type": "PHYSICAL_INTERACTION"
                },
                "timestamp": new Date().toISOString()
            }
        }
    };
}
/**
 * Sent a Doorbell Pressed Event to the Alexa Events Gateway
 * 
 * @param {*} alexaRegion the region of the Alexa Gateway to send event to
 * @param {*} token the LWA bearer token
 * @param {*} endpointId the id of the appliance on Alexa
 */
async function sentDoorbellPress(alexaRegion, token, endpointId) {
    console.log(' --- sentDoorbellPress ---');
    var data = getDoorbellPressData(token, endpointId);
    var headers = getHeaders(token);
    var url;
    // Alexa Gateway is "regionalized", use the right one
    switch (alexaRegion) {
        case 'EU':
            url = ALEXA_EVENT_GATEWAY_EU;
            break;
        case 'FE':
            url = ALEXA_EVENT_GATEWAY_FE
            break;
        case 'NA':
            url = ALEXA_EVENT_GATEWAY_NA;
            break;
        default:
            throw new Error("The selected region is not valid. Please select either NA - EU - FE.");
    }
    return await axios.post(url, data, headers);
}
/**
 * Calls at form submission to send a doorbell pressed event to the accordingly Alexa Gateway
 */
async function doorbellPressedForm() {
    console.log(' --- doorbellPressedForm ---');
    var level = 'INFO';
    var outputText = "Alexa.DoorbellEventSource.DoorbellPress correctly sent";
    try {
        // Retrieve HTML elements values needed to sent DoorbellPress event:
        // Alexa Gateway region
        var alexaRegion = document.getElementById("alexa-region").value;
        // LWA token
        var token = document.getElementById("bearer-token").value;
        // Appliance Id of the device set at Skill Discovery
        var endpointId = document.getElementById("endpoint-id").value;
        // Send event to Alexa Gateway
        var response = await sentDoorbellPress(alexaRegion, token, endpointId);
        console.log("DoorbellPressed Reponse: ", JSON.stringify(response.data, null, 2));
    } catch (exception) {
        level = 'ERROR';
        console.error("Exception: ", JSON.stringify(exception, null, 2));
        // Finding more details about the reason for failure
        // Most probably due to an outdated LWA token
        var payload = (((exception.response || {}).data || {}).payload || {});
        output = payload.description || exception.message || "An exception occured while submitting the doorbell announcement. Please see the logs.";
    }
    // Add result to HTML page
    appendToDiv("divDoorbellResult", level, outputText);
}
////////////////////////////////////////
// LWA TOKEN RENEWAL SPECIFIC
////////////////////////////////////////
/**
 * Returns the JSON structured to be used to as HTTP body when requesting a new LWA token
 * 
 * @param {*} refreshToken a valid LWA refresh token
 * @param {*} clientId the LWA clientId used to connect to the Alexa Events Gateway from the Alexa Skill
 * @param {*} clientSecret the LWA clientSecret used to connect to the Alexa Events Gateway from the Alexa Skill
 */
function getRenewTokenData(refreshToken, clientId, clientSecret) {
    console.log(' --- getRenewTokenData ---');
    return {
        "refresh_token": refreshToken,
        "grant_type": "refresh_token",
        "client_id": clientId,
        "client_secret": clientSecret
    };
}
/**
 * Generates a new LWA token to connect to the Alexa Events Gateway from a given Alexa Skill
 * 
 * @param {*} refreshToken a valid LWA refresh token
 * @param {*} clientId the LWA clientId used to connect to the Alexa Events Gateway from the Alexa Skill
 * @param {*} clientSecret the LWA clientSecret used to connect to the Alexa Events Gateway from the Alexa Skill
 */
async function renewToken(refreshToken, clientId, clientSecret) {
    console.log(' --- renewToken ---');
    const data = getRenewTokenData(refreshToken, clientId, clientSecret);
    const headers = getHeaders();
    return await axios.post(LWA_TOKEN_SERVER, data, headers);
}
/**
 * Calls at form submission to request a new Bearer Token to LWA
 */
async function renewTokenForm() {
    console.log(' --- renewTokenForm ---');
    var level = 'INFO';
    var outputText = "New TOKEN is available. See below";
    var outputData = "";
    try {
        // Retrieve HTML elements values needed to request new LWA token:
        // LWA refresh token
        const refreshToken = document.getElementById("refresh-token").value;
        // LWA Client ID generated to sent events to Alexa Gateway
        const clientId = document.getElementById("client-id-psu").value;
        // LWA Client Secret generated to sent events to Alexa Gateway
        const clientSecret = document.getElementById("client-secret-psu").value;
        // Get new Bearer Token
        var tokenRenewalResponse = await renewToken(refreshToken, clientId, clientSecret);
        console.log("Token Renewal Reponse: ", JSON.stringify(tokenRenewalResponse.data, null, 2));
        // Update HTML textarea containing the token to send doorbell pressed event
        document.getElementById("bearer-token").value = tokenRenewalResponse.data.access_token;
        // Assign returned value to build an HTML table to show response (new token)
        outputData = tokenRenewalResponse.data;
    } catch (exception) {
        level = 'ERROR';
        console.error("Exception: ", JSON.stringify(exception, null, 2));
        // Finding more details about the reason for failure
        var payload = (((exception.response || {}).data || {}).payload || {});
        output = payload.description || exception.message || "An exception occured while requesting a new LWA Token. Please see the logs.";
    }
    // Add result to HTML page
    appendToDiv("divLwaResult", level, outputText);
    appendPrettyPrintTable("divLwaPrettyPrint", outputData);
}
/**
 * Append the given data as an HTML table into the given parent div
 * 
 * @param {*} divId the parent div identifier
 * @param {*} lwaResponseData the data to output as a key/value table
 */
function appendPrettyPrintTable(divId, lwaResponseData) {
    console.log(' --- appendPrettyPrintTable ---');
    var prettyPrintTable =
        `<table> 
        <tr><td> Token Type </td><td> ${lwaResponseData.token_type || "N/A"} </td></tr>
        <tr><td> Expires In </td><td> ${lwaResponseData.expires_in || "N/A"} </td></tr>
        <tr><td> Refresh Token </td><td> ${lwaResponseData.refresh_token || "N/A"} </td></tr>
        <tr><td> Access Token </td><td> ${lwaResponseData.access_token || "N/A"} </td></tr>
    </table>`;
    document.getElementById(divId).innerHTML = prettyPrintTable;
}