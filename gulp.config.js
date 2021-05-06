const { config } = require("process");

module.exports = function(){
    var config = {
        allTs:'./src/app/*.ts',
        tsOutputPath:'./app/'
    };
    return config;
}

