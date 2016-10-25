'use strict';

import sa = require('./solnAnalyzer');
import rm = require('./repoManager');
import um = require('./userManager');
import sb = require('./solnBuilder');
import da = require('./dal');
import fl = require('./fileHandler');

import jwt = require('./jwtManage');
import express = require('express');
import expressJWT = require('express-jwt');
import sio = require('socket.io');

import bodyParser = require('body-parser');
import http = require('http');
var port = process.env.port || 8080;

var app = express();
var xpressJWT: any = expressJWT({ secret: jwt.JwtManager.publicKey, getToken: jwt.JwtManager.extractToken }).unless({
    path: ['/sdlserver', '/sdlserver/socket.io', '/sdlserver/api/Files']
});

app.use(xpressJWT);
app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.warn('Headers(from gen. handler) : ', JSON.stringify(req.headers));
    var headers : any = req.headers;

    if (headers && headers.authorization) {
        jwt.JwtManager.authorization = headers.authorization;
    }

    next();
});

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(express.static('../SDLClient'));

var server = http.createServer(app);
//var io = sio(server, { path: '/sdlserver/socket.io'});
//var io = sio(server).of('/sdlserver');

var analyzer = new sa.SolutionAnalyzer();
var dataAccess = new da.DataAccess();
var repoMgr = new rm.RepoManager(dataAccess);
var builder = new sb.SolutionBuilder(dataAccess);
var usrMgr = new um.UserManager();
var fileHndler = new fl.FileHandler(dataAccess);

app.get('/sdlserver/api/CloneGitRepo', repoMgr.cloneRepository());
app.get('/sdlserver/api/Analyze', analyzer.analyzeSolution());
app.get('/sdlserver/api/BuildSolution', builder.buildSolution());
app.get('/sdlserver/api/Files', fileHndler.getFiles());

var io = sio.listen(server);

io.configure(() => {
    io.set('transports', ['websocket']);
    if (process.env.IISNODE_VERSION) {
        // If this node.js application is hosted in IIS, assume it is hosted 
        // in IIS virtual directory named 'sdlserver' and set up the socket.io's resource
        // value for socket.io to recognize requests that target it. 
        // Note a corresponding change in the client index-socketio.html, as well
        // as necessary URL rewrite rule in web.config. 
        io.set('resource', '/sdlserver/socket.io');
        io.set('authorization', (handshakeData: any, accept: Function) => {
            console.warn('***************  handshakeData token: ' + handshakeData.query['x-auth-token']);
            jwt.JwtManager.verifyToken(handshakeData.query['x-auth-token'], (err: any) => {
                //if (jwt.JwtManager.authorization) {
                //    
                //    handshakeData.headers.authorization = jwt.JwtManager.authorization;
                //    console.warn('Inside authorization - handshakeData.headers.authorization : ' + jwt.JwtManager.authorization);
                //}
                accept(err, err ? false : true);
            });
        });
    }
});

var em = (res: express.Response, e?: Error) => {
    if (e) {
        var ex = JSON.stringify(e);
        return res.status(400).json({ Message: e.message, ExceptionMessage: ex });
    } else {
        res.sendStatus(400);
    }
};

var returnUserData = (username: string, userData: um.UserData, res: express.Response) => {
    usrMgr.getUserDisplayName(username).then((displayName: string) => {
        if (displayName && displayName.length > 0) {
            userData.displayName = displayName;
        }

        res.status(200).json({
            'user': userData,
            'token': jwt.JwtManager.getToken(userData)
        });
    }).catch((e: any) => {
        return em(res, e);
    });
};

app.get('/sdlserver', (req: express.Request, res: express.Response) => {
    var authUser = req.headers['x-iisnode-auth_user'];
    var authenticationType = req.headers['x-iisnode-auth_type'];

    if (authUser && authUser.length > 0) {
        console.warn('User Name is : ', authUser);
        console.warn('Authentication type is : ', authenticationType);
        var tokens = authUser.split('\\');
        var userData: um.UserData = { userName: tokens[1], domainName: tokens[0], displayName: '', id: '' };

        if (!dataAccess) {
            console.warn('********************* dataAccess is null *********************');
            return em(res, { name: 'Error', message: 'dataAccess is null' });
        }

        dataAccess.openDbConnection().then((dbC : any) => {
            dataAccess.getUser(userData).then((result: um.UserData) => {
                if (!result) {
                    dataAccess.getUsersCount().then((count: number) => {
                        dataAccess.insertUser(userData, count + 1).then((reult: any) => {
                            returnUserData(authUser, userData, res);
                        }).catch((e: any) => {
                            return em(res, e);
                        });
                    }).catch((e: any) => {
                        return em(res, e);
                    });
                } else {
                    console.warn('result is : ', result);
                    returnUserData(authUser, result, res);
                }
            }).catch((e: any) => {
                return em(res, e);
            });
        }).catch((e: any) => {
            console.warn('********************* DB Connection is not ready *********************');
            return em(res, { name: 'Error', message: 'DB Connection is not ready' });
        });
    } else {
        console.warn('********************* user is null *********************');
        return em(res, { name: 'Error', message: 'Unable to get user details' });
    }

});

io.on('connection', (socket: SocketIO.Socket) => {
    console.warn('a user connected');
    builder.setSocket(socket);
    repoMgr.setSocket(socket);
    analyzer.setSocket(socket);

    socket.on('disconnect', function () {
        dataAccess.closeDbConnection();
        console.warn('user disconnected');
    });
});

//var project = new pr.analyzer('C:\\Security-Compliance\\Source\\Repos\\BGIT-SDCCI\\ILMerge\\ILMerge.sln');
//var project = new pr.analyzer('C:\\Security-Compliance\\Source\\Repos\\MSRI-ADP\\users\\priyan\\InlookGarage\\InLookApp.sln');
//var project = new pr.analyzer('C:\\Security-Compliance\\Source\\Repos\\EventKnowledge\\OneBoard.sln');
//project.getProjectsFromSolution().then(() => { project.collectExecDetails(); }).catch((e) => {
//    console.log('Error while reading teh solution file');
//});

server.listen(port, () => {
    console.warn('listening on *: ' + port);
});
