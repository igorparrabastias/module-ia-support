const qs = require('qs')

module.exports.params = (options) => {
  return {
    params: options,
    paramsSerializer: (params) => {
      return qs.stringify(params)
    }
  }
}
