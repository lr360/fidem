'use strict';

var fidemSigner = require('./fidem-signer'),
    Q = require('bluebird'),
    http = require('http'),
    logger = require('../config/logger'),
    config = require('meanio').loadConfig();

var childLogger = logger.child({fidem: 'services'});

function createRequest(method, path, body) {
    childLogger.debug(method + ' /api' + path);

    var headers = {};

    if (method !== 'GET' && method !== 'DELETE') {
        if (!headers['Content-Type']) {
            headers['Content-Type'] = 'application/json';
        }
    }

    return {
        method: method,
        host: config.services.host,
        port: config.services.port,
        body: (body) ? JSON.stringify(body) : '',
        path: '/api' + path,
        headers: headers
    };
}

function signRequest(request) {
    return fidemSigner.sign(request, {"accessKeyId": config.accessApiKey, "secretAccessKey": config.accessSecretKey});
}

function executeRequest(signRequest, deferred, body) {
    var executeRequest = http.request(signRequest, function (fidemResponse) {
        fidemResponse.setEncoding('utf8');
        fidemResponse.on('data', function (data) {
            childLogger.debug(data);
            try {
                deferred.resolve({res: fidemResponse, statusCode: fidemResponse.statusCode, body: JSON.parse(data)});
            }
            catch (err) {
                childLogger.error(err);
                deferred.reject(err);
            }
        });
        fidemResponse.on('error', function (err) {
            childLogger.error(err);
            deferred.reject(err);
        });
    });
    if (body) {
        childLogger.debug(JSON.stringify(body));
        executeRequest.write(JSON.stringify(body));
    }

    executeRequest.on('clientError', function (err) {
        childLogger.error(err);
        deferred.reject(err);
    });
    executeRequest.on('error', function (err) {
        childLogger.error(err);
        deferred.reject(err);
    });

    executeRequest.end();
}

module.exports = {

    // High Level
    logAction: function (action) {
        return this.doPost('/gamification/actions', action);
    },
    startSession: function (memberId) {
        var sessionParameters = {};
        if (memberId) {
            sessionParameters.member_id = memberId;
        }
        return this.doPost('/sessions', sessionParameters);
    },
    assignMemberToSession: function (sessionId, memberId) {
        return this.doPut('/session/' + sessionId + '/member/' + memberId, {});
    },
    createMember: function (accountId) {
        var createMemberParameters = {};
        if (accountId) {
            createMemberParameters.account_id = accountId;
        }
        return this.doPost('/members', createMemberParameters);
    },


    // Low Level
    doGet: function (path) {
        var deferred = Q.defer();

        var fidemRequest = createRequest('GET', path);
        var signFidemRequest = signRequest(fidemRequest);
        executeRequest(signFidemRequest, deferred);

        return deferred.promise;
    },
    doPut: function (path, body) {
        var deferred = Q.defer();

        var fidemRequest = createRequest('PUT', path, body);
        var signFidemRequest = signRequest(fidemRequest);
        executeRequest(signFidemRequest, deferred, body);

        return deferred.promise;
    },
    doPost: function (path, body) {
        var deferred = Q.defer();

        var fidemRequest = createRequest('POST', path, body);
        var signFidemRequest = signRequest(fidemRequest);
        executeRequest(signFidemRequest, deferred, body);

        return deferred.promise;
    },
    doDelete: function (path) {
        var deferred = Q.defer();

        var fidemRequest = createRequest('DELETE', path);
        var signFidemRequest = signRequest(fidemRequest);
        executeRequest(signFidemRequest, deferred);

        return deferred.promise;
    }
};