// -*- coding: utf-8 -*-

// Copyright 2020 Amazon.com, Inc. or its affiliates. All Rights Reserved.

// Licensed under the Amazon Software License (the "License"). You may not use this file except in
// compliance with the License. A copy of the License is located at

//    http://aws.amazon.com/asl/

// or in the "license" file accompanying this file. This file is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, express or implied. See the License for the specific
// language governing permissions and limitations under the License.

/**
 * AWS KVS WebRTC Documentation
 * https://docs.aws.amazon.com/kinesisvideostreams-webrtc-dg/latest/devguide/what-is-kvswebrtc.html
 * 
 * Official AWS KVS WebRTC GITHUB Repositories
 * JS       ==> https://github.com/awslabs/amazon-kinesis-video-streams-webrtc-sdk-js
 * C        ==> https://github.com/awslabs/amazon-kinesis-video-streams-webrtc-sdk-c
 * Android  ==> https://github.com/awslabs/amazon-kinesis-video-streams-webrtc-sdk-android
 * iOS      ==> https://github.com/awslabs/amazon-kinesis-video-streams-webrtc-sdk-ios
 */

'use strict';

////////////////////////////////////////
// AWS ACCOUNT SPECIFIC VALUES
////////////////////////////////////////
// AWS Credentials
const AWS_ACCESS_KEY_ID = '_TODO_ADD_YOUR_OWN_';
const AWS_SECRET_ACCESS_KEY = '_TODO_ADD_YOUR_OWN_';
// AWS region
const AWS_REGION = '_TODO_ADD_YOUR_OWN_';
// AWS KVS Signaling Service (Channel)
const AWS_CHANNEL_ARN = '_TODO_ADD_YOUR_OWN_';
////////////////////////////////////////
// HTML ELEMENTS FOR CAMERA STREAMING
////////////////////////////////////////
// Display the local webcam stream (video & audio)
const localView = document.getElementById('local');
// Remote stream for Alexa Device (audio only)
const remoteView = document.getElementById('remote');
////////////////////////////////////////
// OBJECT TO HANDLE STREAMING INFO
////////////////////////////////////////
const kvsMaster = {};
////////////////////////////////////////
// FUNCTIONS
////////////////////////////////////////
/**
 * Initialize connection to AWS KVS Signaling Service (channel)
 */
async function initializeKVS() {
    // Create the KVS Client from above credentials
    console.log('[SETUP] Creating KVS Client ...');
    const kinesisVideoClient = new AWS.KinesisVideo({
        region: AWS_REGION,
        accessKeyId: AWS_ACCESS_KEY_ID,
        secretAccessKey: AWS_SECRET_ACCESS_KEY,
    });
    kvsMaster.kinesisVideoClient = kinesisVideoClient;
    // Use KVS Client to get urls for Signaling Server for both HTTPS & WebSocket
    console.log('[SETUP] Gathering KVS Signaling Channel Endpoint ...');
    const getSignalingChannelEndpointResponse = await kinesisVideoClient
        .getSignalingChannelEndpoint({
            ChannelARN: AWS_CHANNEL_ARN,
            SingleMasterChannelEndpointConfiguration: {
                Protocols: ['WSS', 'HTTPS'],
                Role: KVSWebRTC.Role.MASTER,
            },
        })
        .promise();
    // Set endpoints as array using protocol as key
    const endpointsByProtocol = getSignalingChannelEndpointResponse.ResourceEndpointList.reduce((endpoints, endpoint) => {
        endpoints[endpoint.Protocol] = endpoint.ResourceEndpoint;
        return endpoints;
    }, {});
    // Assigning endpoints to master object
    kvsMaster.getSignalingChannelEndpointResponse = getSignalingChannelEndpointResponse;
    kvsMaster.endpointsByProtocol = endpointsByProtocol;
    console.log('[SETUP] Endpoints: ' + JSON.stringify(endpointsByProtocol, null, 2));
    // STUN servers - one STUN URL per AWS REGION
    const iceServers = [
        { urls: `stun:stun.kinesisvideo.${AWS_REGION}.amazonaws.com:443` }
    ];
    /**
     * Note: Using KVS TURN servers to generate a SDP answer will fail in Alexa context 
     * as it does not respect the 3 seconds timeout set by Alexa
     * => ignoring TURN servers gathering (below commented code)
     * /
    // Create a KVS Signaling Channel client to gather ICE servers
    console.log('[SETUP] Creating KVS Signaling Channel ...');
    const kinesisVideoSignalingChannelsClient = new AWS.KinesisVideoSignalingChannels({
        region: AWS_REGION,
        accessKeyId: AWS_ACCESS_KEY_ID,
        secretAccessKey: AWS_SECRET_ACCESS_KEY,
        endpoint: endpointsByProtocol.HTTPS,
    });
    kvsMaster.kinesisVideoSignalingChannelsClient = kinesisVideoSignalingChannelsClient;
    // Get TURN servers for Signaling Channel
    console.log('[SETUP] Gathering ICE servers from KVS Signaling Channel ...');
    const getIceServerConfigResponse = await kinesisVideoSignalingChannelsClient
    .getIceServerConfig({
        ChannelARN: AWS_CHANNEL_ARN,
    })
    .promise();
    // Append TURN servers to list of ICE servers
    getIceServerConfigResponse.IceServerList.forEach(iceServer =>
        iceServers.push({
            urls: iceServer.Uris,
            username: iceServer.Username,
            credential: iceServer.Password,
        }),
    );
    /**/
    kvsMaster.iceServers = iceServers;
    console.log('[SETUP] KVS ICE servers: ' + JSON.stringify(iceServers, null, 2));
    // Create the Client to connect to Signaling Channel
    console.log('[SETUP] Creating Signaling Client ...');
    const signalingClient = new KVSWebRTC.SignalingClient({
        channelARN: AWS_CHANNEL_ARN,
        channelEndpoint: endpointsByProtocol.WSS,
        role: KVSWebRTC.Role.MASTER,
        region: AWS_REGION,
        credentials: {
            accessKeyId: AWS_ACCESS_KEY_ID,
            secretAccessKey: AWS_SECRET_ACCESS_KEY,
        },
    });
    kvsMaster.signalingClient = signalingClient;
    // Add behaviors to Signaling Channel Client to be notified when events are happening
    attachListeners(signalingClient);
    // Signaling Channel is functionnal and ready to use
    console.log('[SETUP] Ready to use AWS KVS WebRTC!');
    console.log('[SETUP] Click "Start Camera" to begin streaming ');
}
/**
 * Attach Listeners to KVS Signaling Channel Client for:
 * - Client Open | Close
 * - Client Error
 * - Client ICE Candidate received
 * - Client SDP Offer
 * - RTC Connection Track Added
 * - RTC Connection ICE Candidate Added
 * - RTC Connection ICE Status Changed
 * 
 * @param {*} signalingClient the KVS Signaling Channel client
 */
async function attachListeners(signalingClient){
    // Objective: Once the signaling channel connection is open, connect to the webcam and create an offer to send to the master
    console.log('[SETUP] Adding listeners for Signaling Client');
    // Add listener to know when connection is open 
    signalingClient.on('open', async () => {
        console.log('[MASTER] Connected to signaling service');
    });
    // Add listener to know when Alexa is sending an SDP Offer
    // Note: Alexa is the Viewer | Webcam is the Master
    signalingClient.on('sdpOffer', async (offer, remoteClientId) => {
        console.log('[MASTER] Received SDP offer from client: ' + remoteClientId);
        console.log('[MASTER] Creating RTCPeerConnection ...');
        const peerConnection = new RTCPeerConnection({
            iceServers: kvsMaster.iceServers
        });
        // Add listener to know when a new ICE candidate is added for SDP Answer generation
        peerConnection.addEventListener('icecandidate', ({ candidate }) => {
            if (candidate) {
                console.log('[MASTER] Generated ICE candidate for client: ' + remoteClientId);
                console.log('[MASTER] ICE candidate: ' + JSON.stringify(candidate, null, 2));
            }
        });
        // Add listener to know when all ICE candidates have been generated
        peerConnection.addEventListener('icegatheringstatechange', (event) =>{
            console.log('[MASTER] ICE Gathering State: ' + peerConnection.iceGatheringState);
            switch(peerConnection.iceGatheringState){
                case 'failed':
                    console.log('[MASTER] Fail to gather ICE candidate: ', event)
                    stopVideo(remoteView);
                    closePeerConnection();
                    break;
                case 'complete':
                    console.log('[MASTER] All ICE candidates have been generated for client: ' + remoteClientId);
                    console.log('[MASTER] Sending SDP Answer for remoteId: ', remoteClientId)
                    var answer = peerConnection.localDescription;
                    console.log('[MASTER] SDP Answer: ', answer.sdp)
                    signalingClient.sendSdpAnswer(peerConnection.localDescription, remoteClientId);
                    break;
            }
        });
        // Add Listener to know when a track (Media) is added from Alexa
        peerConnection.addEventListener('track', event => {
            console.log('[MASTER] Received remote track from client: ' + remoteClientId);
            if (remoteView.srcObject) {
                return;
            }
            // Attach track to HTML element and start playing audio from Alexa
            playVideo(remoteView, event.streams[0]);
        });
        // Add RTC connection to master object
        kvsMaster.peerConnection = peerConnection;
        // Add Webcam medias (audio & video) to local stream
        const localStream = kvsMaster.localStream;
        if (localStream) {
            localStream.getTracks().forEach(track => {
                peerConnection.addTrack(track, localStream);
            });
        }       
        // Add SDP offer (from Alexa) to RTC connection as remote
        await peerConnection.setRemoteDescription(offer);
        // Create SDP Answer to be sent to Alexa
        await peerConnection.setLocalDescription(
            await peerConnection.createAnswer({
                offerToReceiveAudio: true,
                offerToReceiveVideo: true,
            }),
        );
    });
    // When an ICE candidate is received from the client (Alexa), add it to the peer connection.
    signalingClient.on('iceCandidate', (candidate, remoteClientId) => {
        console.log('[MASTER] Received ICE candidate from client: ' + remoteClientId);
        kvsMaster.peerConnection.addIceCandidate(candidate);
    });
    // Add Listener to know when the connection is close on Signaling channel
    signalingClient.on('close', () => {
        console.log('[MASTER] Disconnected from signaling channel');
    });
    // Add Listener to know when an error occured on Signaling channel
    signalingClient.on('error', error => {
        console.error('[MASTER] Signaling client error'), error;
    });
}
/**
 * Get a stream from the webcam, add it to the peer connection, and display it in the local view
 */
async function prepareMedia() {
    console.log('[MASTER] Starting Webcam streaming');
    try {
        // Get Video & Audio Resources for Browser
        const localStream = await navigator.mediaDevices.getUserMedia({
            //video: { width: { ideal: 640}, height: { ideal: 480 } }, // 480p
            //video: { width: { ideal: 1280 }, height: { ideal: 720 } }, // 720p
            //video: { width: { ideal: 1920}, height: { ideal: 1080 } }, // 1080p
            video: { width: { ideal: 480}, height: { ideal: 640 } }, // 480p portrait
            //video: { width: { ideal: 720}, height: { ideal: 1280 } }, // 720p portrait
            //video: { width: { ideal: 1080}, height: { ideal: 1920 } }, // 1080p portrait
            audio: true,
        });
        // Add resources to KVS object
        kvsMaster.localStream = localStream;
        // Start local display
        playVideo(localView, localStream);
    } catch (e) {
        console.error('[MASTER] Webcam streaming error: ', e);
    }
}
/**
 * Assign the Audio/Video resources to a given HTML element
 * 
 * @param {*} element the HTML element
 * @param {*} stream the input cam/mic stream
 */
async function playVideo(element, stream) {
    element.srcObject = stream;
    await element.play().catch(err => console.error(err));
    element.volume = 1;
}
/**
 * Pause the Audio/Video resources for a given HTML element 
 * @param {*} element 
 */
function stopVideo(element) {
    if (element.srcObject) {
        element.pause();
        element.srcObject = null;
    }
}
/**
 * Start the connection to KVS Signaling Channel
 */
async function startMaster() {
    console.log('[MASTER] Starting master connection');
    await prepareMedia();
    kvsMaster.signalingClient.open();
}
/**
 * Stop the connecto to KVS Signaling Channel
 * It stop local & remote Audio/Video ressources and clear all resources.
 */
function stopMaster() {
    console.log('[MASTER] Stopping master connection');
    stopVideo(localView);
    stopVideo(remoteView);
    // Close connection to KVS Channel
    if (kvsMaster.signalingClient) {
        kvsMaster.signalingClient.close();
        // Note: do not delete it (assign to null), it can be reused on stop/start camera
    }
    // Cleanup RTC Connection: close & delete
    if (kvsMaster.peerConnection) {
        kvsMaster.peerConnection.close();
        kvsMaster.peerConnection = null;
    }
    // Cleanup Media Resources: stop & delete
    if (kvsMaster.localStream) {
        kvsMaster.localStream.getTracks().forEach(track => track.stop());
        kvsMaster.localStream = null;
    }
    // Clean HTML local video element
    if (kvsMaster.localView) {
        kvsMaster.localView.srcObject = null;
    }
    // Clean HTML remote audio element
    if (kvsMaster.remoteView) {
        kvsMaster.remoteView.srcObject = null;
    }
}
/**
 * Close the RTC Connection and clean connection
 */
function closePeerConnection() {
    if (kvsMaster.peerConnection) {
        kvsMaster.peerConnection.close();
        kvsMaster.peerConnection = null;
    }
}