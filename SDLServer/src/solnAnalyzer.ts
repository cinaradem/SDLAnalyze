'use strict';

import express = require('express');
import Q = require('q');

import base = require('./base');
import fs = require('fs');
import path = require('path');
import rl = require('readline');
import spawn = require('child_process');
import jwt = require('./jwtManage');
import jsonwt = require('jsonwebtoken');
import ut = require('./utils');
var utils = ut.Utils;

interface Project {
    name: string,
    path: string,
    folder: string,
    type?: string,
    assembly?: string,
    id: string,
    outputPaths: Array<string>,
    refPaths: Array<string>,
    outputs: {},
    vsVersion: number
};

export class SolutionAnalyzer extends base.Base {
    //projects: Array<Project> = [];
    gitCloneRootFolder: string = 'C:\\GitRepos\\';

    constructor() {
        super();
    }

    analyzeSolution = (): express.RequestHandler => {
        var self = this;
        return (req: express.Request, res: express.Response) => {
            try {
                jwt.JwtManager.authenticate(req.headers).then((decoded: any) => {
                    var query = req.query;
                    var solutionPath = query.solnPath;
                    console.warn('Solution Path :' + solutionPath);
                    if (!solutionPath || !solutionPath.length) {
                        return res.status(400).json({ Message: 'Solution Path is invalid.' });
                    }

                    var id = decoded._id;
                    if (!id || !id.length) {
                        return res.status(401).json('No valid id exist for this user');
                    }
                    var messageId = jsonwt.sign({ method: 'analyzeSolution' }, Date.now().toLocaleString());
                    res.status(200).json(messageId);

                    solutionPath = path.join(self.gitCloneRootFolder, id, solutionPath);

                    var solutionFolder = path.dirname(solutionPath);
                    var fxcopOutFolder = path.join(solutionFolder, 'FxCopOut');

                    fs.exists(fxcopOutFolder, (exists: boolean): void => {
                        if (!exists) {
                            console.warn('Creating FXCop output Folder :' + fxcopOutFolder);
                            fs.mkdirSync(fxcopOutFolder);
                        }
                    });

                    self.getProjectsFromSolution(solutionPath).then((projects: Array<Project>) => {
                        if (!projects || projects.length === 0) {
                            self.sendSocketMessage(messageId, {
                                slnFile: query.solnPath,
                                Message: 'There are no project outputs to analyze'
                            });
                        }
                        self.collectExecDetails(id, fxcopOutFolder, projects).then(() => {
                            self.sendSocketMessage(messageId, projects);
                        }).catch((ex: any) => {
                            self.sendSocketMessage(messageId, {
                                slnFile: query.solnPath,
                                Message: 'Error while executing the analysis',
                                ExceptionMessage: ex
                            });
                        });
                    }).catch((ex: any) => {
                        self.sendSocketMessage(messageId, {
                            slnFile: query.solnPath,
                            Message: 'Error while reading the solution file',
                            ExceptionMessage: ex
                        });
                    });
                }).catch((ex: any) => {
                    console.warn('Error while authentication: ' + JSON.stringify(ex));
                    return res.status(401).json('Failed to authenticate token.');
                });

            } catch (ex) {
                console.warn('Unexpected Error during FXCop analysis' + ex);
                self.sendExceptionMessage(res, 'Unexpected Error during FXCop analysis', ex);
            }
        };
    }

    getProjectsFromSolution = (solutionPath: string): Q.Promise<any> => {
        var deferred = Q.defer();
        var solutionFolder = path.dirname(solutionPath);
        var projects: Array<Project> = [];
        if (solutionPath) {
            fs.exists(solutionPath, (exists: boolean) => {
                if (exists) {
                    var vsVersion: number = 0;
                    const rr = fs.createReadStream(solutionPath);
                    const reader = rl.createInterface({ input: rr });
                    reader.on('line', (line: string) => {
                        if (utils.strStartsWith(line, 'VisualStudioVersion')) {
                            var verDetails: string = utils.trimExcess(line.split('=')[1]);
                            vsVersion = parseInt(verDetails.substr(0, 2), 10);
                        }
                        if (utils.strStartsWith(line, 'Project(')) {
                            var projectDetails = line.split('=')[1];
                            if (projectDetails) {
                                var d = projectDetails.split(',');
                                if (Array.isArray(d) && d.length === 3) {
                                    var p = path.join(solutionFolder, utils.trimExcess(d[1]));
                                    if (fs.existsSync(p)) {
                                        var isDir = fs.statSync(p).isDirectory();
                                        if (!isDir) {
                                            projects.push({
                                                'name': utils.trimExcess(d[0]),
                                                'path': p,
                                                'folder': path.dirname(p),
                                                'id': utils.trimExcess(d[2]),
                                                'outputPaths': [],
                                                'refPaths': [],
                                                'outputs': {},
                                                'vsVersion': vsVersion
                                            });
                                        }
                                    }
                                }
                            }
                        }
                    });

                    reader.on('close', () => {
                        //                        console.warn('There will be no more data. from reader');
                        deferred.resolve(projects);
                    });
                } else {
                    console.warn('The solution file doesn\'t exist');
                    deferred.reject('The solution file doesn\'t exist');
                }
            });
        }

        return deferred.promise;
    }
    collectExecDetails = (userId: string, fxcopOutFolder: string, projects: Array<Project>): Q.Promise<{}> => {
        var deferred: Q.Deferred<{}> = Q.defer();
        var defArray: Array<Q.Promise<string>> = [];
        var self = this;

        projects.forEach((p: Project) => {
            fs.exists(p.path, (exists: boolean) => {
                if (exists) {
                    self.fileRead(p.path, self.storeOutputPath, p).then(() => {
                        for (var i = 0; i < p.outputPaths.length; i++) {
                            var assemblyPath = '';
                            var configTokens = p.outputPaths[i].split('\\');
                            if (p.type && p.type.length) {
                                var type = p.type.toLowerCase();
                                if (type === 'library') {
                                    assemblyPath = path.resolve(p.folder + '\\' + p.outputPaths[i] + p.assembly + '.dll');
                                } else if (type === 'exe') {
                                    assemblyPath = path.resolve(p.folder + '\\' + p.outputPaths[i] + p.assembly + '.exe');
                                }

                                if (fs.existsSync(assemblyPath)) {
                                    console.warn('Executing fxcop on ' + assemblyPath);
                                    var pr = self.executeFxCop(userId, assemblyPath,
                                        fxcopOutFolder + p.assembly + '-' +
                                        (configTokens.length > 1 ? configTokens[1] : configTokens[0]) + '-FXCopOut.xml', p.refPaths, p);

                                    defArray.push(pr);
                                    pr.then(() => {
                                        utils.resolveIfAll(defArray, deferred);
                                    }).catch((ex: any) => {
                                        utils.resolveIfAll(defArray, deferred);
                                    });

                                } else {
                                    //console.warn(assemblyPath + ' don\'t exist');
                                }
                            } else {
                                deferred.reject('The project type could not be identified.');
                            }

                            //console.warn(p.type + ';' + p.assembly + ';' + p.folder + '\\' + p.outputPaths[i]);
                        }
                    });
                    // console.warn(p.name + ';' + p.path + ';' + p.folder + ';' + p.id);
                } else {
                    //console.warn(p.path + ' don\'t exist');
                }
            });
        });

        return deferred.promise;
    }

    private executeFxCop = (userId: string, assembly: string, output: string,
        refPaths: Array<string>, proj: Project): Q.Promise<string> => {
        var deferred = Q.defer<string>();
        var self = this;
        fs.exists(assembly, (exists: boolean) => {
            if (exists) {
                self.deleteOutputIfExist(output, deferred, () => {
                    var options = ['/f:' + assembly];
                    refPaths.forEach((r: string) => {
                        options.push('/d:' + r);
                    });

                    var fxCopExe = '';
                    switch (proj.vsVersion) {
                        case 12: {
                            fxCopExe = 'C:\\Program Files (x86)\\Microsoft Visual Studio 12.0\\' +
                                'Team Tools\\Static Analysis Tools\\Fxcop\\fxcopcmd.exe';
                            options = options.concat(['/to:5',
                                '/gac',
                                '/fo',
                                '/c',
                                '/cxsl:' +
                                'C:\\Program Files (x86)\\Microsoft Visual Studio 12.0\\Team Tools\\' +
                                'Static Analysis Tools\\FxCop\\Xml\\VSConsoleOutput.xsl',
                                '/axsl']);
                            break;
                        }
                        case 14: {
                            fxCopExe = 'C:\\Program Files (x86)\\Microsoft Visual Studio 14.0\\' +
                                'Team Tools\\Static Analysis Tools\\Fxcop\\fxcopcmd.exe';
                            options = options.concat(['/rmia',
                                '/to:5',
                                '/gac',
                                '/fo',
                                '/c',
                                '/cxsl:' +
                                'C:\\Program Files (x86)\\Microsoft Visual Studio 14.0\\Team Tools\\' +
                                'Static Analysis Tools\\FxCop\\Xml\\VSConsoleOutput.xsl',
                                '/ruleset:=' +
                                'C:\\Program Files (x86)\\Microsoft Visual Studio 14.0\\' +
                                'Team Tools\\Static Analysis Tools\\Rule Sets\\Sdl7.0.ruleset',
                                '/axsl']);
                            break;
                        }
                        default: {
                            deferred.resolve('Unknown Visual Studio Version');
                            return;
                        }
                    }

                    //options = options.concat(['/rmia',
                    //    '/to:5',
                    //    '/gac',
                    //    '/fo',
                    //    '/outxsl:' +
                    //    'C:\\Program Files (x86)\\Microsoft Visual Studio 14.0\\Team Tools\\' +
                    //    'Static Analysis Tools\\FxCop\\Xml\\VSConsoleOutput.xsl',
                    //    '/ruleset:=' +
                    //    'C:\\Program Files (x86) \\Microsoft Visual Studio 14.0\\' +
                    //    'Team Tools\\Static Analysis Tools\\Rule Sets\\Sdl7.0.ruleset',
                    //    '/out:' + output]);

                    var out = '';
                    var strippedAssembly = assembly.replace(utils.re, '').substr(path.delimiter.length + userId.length);
                    if (!proj.outputs[strippedAssembly]) {
                        proj.outputs[strippedAssembly] = '';
                    }

                    try {
                        const cmd = spawn.spawn(fxCopExe, options);
                        cmd.stdout.on('data', (data: string) => {
                            out += data;
                        });

                        cmd.stderr.on('data', (data: string) => {
                            console.warn('Error: ' + data);
                            deferred.resolve('Error: ' + data);
                        });

                        cmd.on('close', (code: string) => {
                            //console.warn('************************Assembly ***************************** ' + assembly);
                            out = out.replace(RegExp(userId, 'gi'), '');
                            proj.outputs[strippedAssembly] = utils.splitByCRLF(out);
                            console.warn('child process exited with code ' + code);
                            deferred.resolve('child process exited with code ' + code);
                        });
                    } catch (e) {
                        console.warn(e.toJSON());
                        deferred.resolve('Error: ' + e);
                    };
                });
            } else {
                deferred.resolve(`assembly don't exist`);
                console.warn(assembly + ' don\'t exist');
            }
        });

        return deferred.promise;
    }
    /*
        private suppressFullPath = (data: string): string => {
            if (data.indexOf(': warning  :') !== -1 || data.indexOf(': error  :') !== -1) {
                data = data.replace(this.re, '');
            }
    
            return data;
        }
    
        private splitOutputMessage = (message: string): Array<string> => {
            var self = this;
            let splits = [];
            var m = '';
            message.split('').map((c: any) => {
                if (c === '\r') {
                    splits.push(self.suppressFullPath(m));
                    m = '';
                    return;
                };
                if (c !== '\n') {
                    m += c;
                }
            });
            return splits;
        }
    */
    private deleteOutputIfExist = (output: string, deferred: Q.Deferred<any>, callback: Function): void => {
        fs.exists(output, (exists: boolean) => {
            try {
                if (exists) {
                    console.warn('Deleting FXCop output File : ' + output);
                    fs.unlinkSync(output);
                    callback();
                } else {
                    callback();
                }
            } catch (e) {
                deferred.resolve('Error deleting output file');
                console.warn('Inside Catch : ' + e);
            }
        });
    }

    private storeOutputPath = (xml: any, project: any): void => {
        if (xml) {
            xml = xml.trim();
            if (xml.startsWith('<OutputType>')) {
                project.type = this.getXMLValue(xml, 'OutputType');
                return;
            }

            if (xml.startsWith('<AssemblyName>')) {
                project.assembly = this.getXMLValue(xml, 'AssemblyName');
                return;
            }

            if (xml.startsWith('<OutputPath>')) {
                project.outputPaths.push(this.getXMLValue(xml, 'OutputPath'));
                return;
            }

            if (xml.startsWith('<HintPath>')) {
                var refPath = this.getXMLValue(xml, 'HintPath');
                var tokens = refPath.split('\\');
                var resPath = null;
                var tLength = tokens.length;
                if (tLength > 1) {
                    if (tokens[tLength - 1].lastIndexOf('dll') > 0) {
                        var assemblyPath = '';
                        for (var j = 0; j < tLength - 1; j++) {
                            assemblyPath += tokens[j] + '/';
                        }

                        var fullPath = path.resolve(assemblyPath);
                        if (fs.existsSync(fullPath)) {
                            resPath = fullPath;
                        } else {
                            if (tokens[0] === '..') {
                                resPath = path.resolve(project.folder, assemblyPath);
                            } else if (refPath.indexOf('$') >= 0) {
                                resPath = tokens[0];
                            }
                        }
                    } else if (tokens[0] === '..') {
                        var found = false;
                        resPath = path.resolve(project.folder, tokens[0], tokens[1]);
                    } else {
                        console.warn(refPath + ' is not supported yet');
                    }

                    if (resPath) {
                        for (var i = 0; i < project.refPaths.length; i++) {
                            if (project.refPaths[i] === resPath) {
                                found = true;
                                break;
                            }
                        }

                        if (!found) {
                            console.warn(resPath);
                            project.refPaths.push(resPath);
                        }
                    }

                }
                return;
            }
        }
    }
    private getXMLValue = (xml: string, tag: string): string => {
        var index = xml.lastIndexOf('</' + tag + '>');
        var val = xml.substring(tag.length + 2, index);
        return val;
    }

    private fileRead = (file: string, callback: Function, project: any): Q.Promise<{}> => {
        var deferred = Q.defer();
        const rr = fs.createReadStream(file);
        const reader = rl.createInterface({ input: rr });
        reader.on('line', (line: string) => {
            callback(line, project);
        });

        reader.on('close', () => {
            callback(null);
            deferred.resolve();
        });

        return deferred.promise;
    }
}
