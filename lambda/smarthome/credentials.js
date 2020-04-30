// -*- coding: utf-8 -*-

// Copyright 2020 Amazon.com, Inc. or its affiliates. All Rights Reserved.

// Licensed under the Amazon Software License (the "License"). You may not use this file except in
// compliance with the License. A copy of the License is located at

//    http://aws.amazon.com/asl/

// or in the "license" file accompanying this file. This file is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, express or implied. See the License for the specific
// language governing permissions and limitations under the License.

'use strict'

module.exports = {
    // LWA configuration
    lwa:{
        client_id: "_ADD_YOUR_OWN_",
        client_secret: "_ADD_YOUR_OWN_",
        grant_type: "authorization_code",
        token_server: "https://api.amazon.com/auth/o2/token"
    },
    // AWS KVS WebRTC - Signaling Server
    kvs:{
        region: "_ADD_YOUR_OWN_",
        channel_name: "_ADD_YOUR_OWN_",
        channel_arn: "_ADD_YOUR_OWN_"
    }
}