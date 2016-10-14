// Utility functions

const fs = require('fs')
const path = require('path')


/**
 * Return all subdirectoies in given directory
 * @param {string} directory root directory
 * @returns {Array} list of subdirectory
 */
const getSubDirectories = (directory) => {
  return fs.readdirSync(directory).filter(file => {
    return fs.statSync(path.join(directory, file)).isDirectory()
  })
}

/**
 * Return all csv files (parsing to integer names) in directory
 * @param {string} directory root directory
 * @returns {Array} list of .csv files
 */
const getWeekFiles = (directory) => {
  let newFiles = fs.readdirSync(directory)
      .filter(f => f.endsWith('.csv'))
  return newFiles.map(file => parseInt(file.split()[0]))
}

/**
 * Filter data returned from tranform.longToJson according to region
 * @param {Array} data data returned from longToJson
 * @param {string} region region identifier to filter on
 * @returns {Object} an object with output for the region
 */
const regionFilter = (data, region) => {
  let filtered = {}

  let keyOrder = [
    'onsetWeek',
    'peakWeek',
    'peakPercent',
    'oneWk',
    'twoWk',
    'threeWk',
    'fourWk'
  ]

  data.filter(d => d.region == region).forEach((d, idx) => {
    filtered[keyOrder[idx]] = {
      point: d.point,
      low: d.low,
      high: d.high
    }
  })

  return filtered
}


exports.getSubDirectories = getSubDirectories
exports.regionFilter = regionFilter
exports.getWeekFiles = getWeekFiles
