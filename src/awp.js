// publish to awp
// 
var path = require('path');
var fs = require('fs');
var request = require('request');
var chalk = require('chalk');
var crypto = require('crypto');


function md5 (s) {
    return crypto.createHash('md5').update(s, 'utf8').digest('hex');
}
function extend (target, source, isOverwrite) {
    if (isOverwrite == undefined) isOverwrite = true;
    for (var k in source) {
        if (!(k in target) || isOverwrite) {
            target[k] = source[k]
        }
    }
    return target;
}
function getToken (o) {
    var api = o.api;
    var data = o.data;
    var operator = o.operator;
    var t = o.t;
    var token = o.token;

    if (!api || !data || !operator || !t || !token) {
        console.log(chalk.red.bold('[Fail] ') + 'MD5生成Token失败，请检查传入参数');
        return;
    }
    return md5([api, data, operator, t, token].join('&'));
}


function Pub2awp (opt, success, fail) {
    /**
     * opt
     * {
     *     operator,
     *     env,
     *     token,
     *     appid,
     *     filePath,
     *     publishDir,
     *     isautoparse, //可选
     *     needPerform, //可选
     *     autoPub, //可选
     *     delVersionIfExist, //可选
     * }
     */

    var defaults = {
        api: 'push_file',
        t: Date.now(),
        operator: null, //花名，必须
        token: null, // 日常或者线上的发布者awp token
        data: {
                uri: null, // 必须 发布路径
                operator: null, // 必须
                data: null, // 必须 file content
                isPub: true, // 发布或者预览
                webappId: null,// 必须
                pageData: {
                    isautoparse: false, // 是否auto parse
                    needPerform: false, // 是否需要摩天轮性能测试
                    autoPub: false, //是否自动发布tms
                    delVersionIfExist: false //是否删除已经存在的版本
                }
            }
    }

    opt.env = opt.env || 'waptest';
    this.option = opt;
    this.successCallback = success;
    this.failCallback = fail;

    var requestUri = this.getRequestUri(opt.env, opt.appid);
    var requestParam = this.getRequestParam(defaults, opt);
    //console.log(requestUri, requestParam)
    this.request(requestUri, requestParam);
}

Pub2awp.prototype = {
    getRequestUri: function (p, appid) {
        var map = {
            'waptest': 'daily.',
            'wapa': 'pre.',
            'wapp': '',
            'm': ''
        };
        return 'http://' + map[p] + 'h5.taobao.org/api/api.do?_input_charset=utf-8&api=push_file&webappId=' + appid;
    },
    getRequestParam: function (defaults, opt) {
        if (!opt.publishDir) opt.publishDir = '';

        defaults.t = Date.now();
        defaults.operator = opt.operator;
        defaults.token = opt.token;
        defaults.data.uri = (opt.publishDir.replace(/\/$/, '') + '/' + path.basename(opt.filePath)).replace(/^\//, '');
        defaults.data.operator = opt.operator;
        defaults.data.data = fs.readFileSync(opt.filePath, {encoding:'utf8'});
        defaults.data.isPub = !(opt.env === 'wapp');
        defaults.data.webappId = opt.appid;

        Object.keys(defaults.data.pageData).forEach(function (key) {
            if (key in opt) {
                defaults.data.pageData[key] = opt[key]
            }
        });

        defaults.data.pageData = JSON.stringify(defaults.data.pageData);
        defaults.data = JSON.stringify(defaults.data);
        //rewrite to md5 token
        defaults.token = getToken(defaults);
    
        return defaults;
    },
    request: function (uri, param) {
        var me = this;
        request.post({
            headers: {
                'X-Forwarded-For': '10.232.135.52' // 通用跳板机
            },
            url: uri,
            form: param,
            encoding: 'utf8',
            json: true
        }, function (err, response, ret) {
            if (err) {
                console.log(chalk.red.bold('[Fail] ') + '发布失败😢，请检查下您的网络连接！');
                console.error(err);
            } else if (!ret.success) {
                // 发布失败
                console.log(chalk.red.bold('[Fail] ') + me.option.filePath);
                console.log(chalk.red.bold(ret.msg.replace(/\n/igm, '')));
                me.failCallback && me.failCallback();
            } else {
                // 发布成功
                if (ret.data) {
                    console.log(chalk.green.bold('[Success] ') + ('发布成功，版本号：'+ret.data.versionId+' <'+me.option.filePath+'>\n | 预览地址：'+ret.data.previewUrl+'\n | 线上地址：' + ret.data.onlineUrl));
                } else {
                    console.log(chalk.green.bold('[Success] ' + me.option.filePath));
                }
                me.successCallback && me.successCallback();
            }
        });
    }
}

module.exports = Pub2awp;