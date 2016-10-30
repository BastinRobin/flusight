// Chart plotting functions

import * as util from './utils/timechart'
import * as marker from './markers/timechart'

export default class TimeChart {
  constructor(d3, elementId, weekHook) {
    // Get div dimensions
    let footBB = d3.select('.footer').node().getBoundingClientRect(),
        chartBB = d3.select('#' + elementId).node().getBoundingClientRect()

    let divWidth = chartBB.width,
        divHeight = window.innerHeight - chartBB.top - footBB.height

    // Create blank chart
    let margin = {
      top: 10, right: 50, bottom: 70, left: 40
    },
        width = divWidth - margin.left - margin.right,
        height = divHeight - margin.top - margin.bottom

    // Initialize scales and stuff
    let xScale = d3.scaleLinear()
        .range([0, width]),
        yScale = d3.scaleLinear()
        .range([height, 0]),
        xScaleDate = d3.scaleTime()
        .range([0, width])

    // Add svg
    let svg = d3.select('#' + elementId).append('svg')
        .attr('width', width + margin.left + margin.right)
        .attr('height', height + margin.top + margin.bottom)
        .append('g')
        .attr('transform', 'translate(' + margin.left + ',' + margin.top + ')')

    // Add tooltip
    this.tooltip = d3.select('body').append('div')
      .attr('id', 'chart-tooltip')
      .style('position', 'fixed')
      .style('display', 'none')

    // Save variables
    this.d3 = d3
    this.svg = svg
    this.xScale = xScale
    this.yScale = yScale
    this.xScaleDate = xScaleDate
    this.height = height
    this.width = width
    this.weekHook = weekHook

    // Add axes
    this.setupAxes()

    // Add marker primitives
    this.timerect = new marker.TimeRect(this)

    // Add overlays and other mouse interaction items
    this.setupOverlay()

    this.baseline = new marker.Baseline(this)
    this.actual = new marker.Actual(this)
    this.predictions = []
  }

  /**
   * Setup axes
   */
  setupAxes() {
    let svg = this.svg,
        width = this.width,
        height = this.height

    svg.append('g')
      .attr('class', 'axis axis-x')
      .attr('transform', 'translate(0,' + height + ')')

    svg.append('g')
      .attr('class', 'axis axis-x-date')
      .attr('transform', 'translate(0,' + (height + 25) + ')')
      .append('text')
      .attr('class', 'title')
      .attr('text-anchor', 'middle')
      .attr('transform', 'translate(' + width / 2 + ',' + 40 + ')')
      .text('Epidemic Week')

    svg.append('g')
      .attr('class', 'axis axis-y')
      .append('text')
      .attr('class', 'title')
      .attr('transform', 'translate(-40 ,' + height / 2 + ') rotate(-90)')
      .attr('dy', '.71em')
      .style('text-anchor', 'middle')
      .text('Weighted ILI (%)')
  }

  /**
   * Setup overlay for mouse events
   */
  setupOverlay() {
    let d3 = this.d3,
        svg = this.svg,
        xScale = this.xScale,
        yScale = this.yScale,
        weekHook = this.weekHook,
        tooltip = this.tooltip

    // Add vertical line
    let line = this.svg.append('line')
        .attr('class', 'hover-line')
        .attr('x1', 0)
        .attr('y1', 0)
        .attr('x2', 0)
        .attr('y2', this.height)
        .style('display', 'none')

    // Get bounding box
    let bb = svg.node().getBoundingClientRect()

    svg.append('rect')
      .attr('class', 'overlay')
      .attr('height', this.height)
      .attr('width', this.width)
      .on('mouseover', () => {
        line.style('display', null)
        tooltip.style('display', null)
      })
      .on('mouseout', () => {
        line.style('display', 'none')
        tooltip.style('display', 'none')
      })
  }

  // plot data
  plot(data) {
    let d3 = this.d3,
        svg = this.svg,
        xScale = this.xScale,
        yScale = this.yScale,
        xScaleDate = this.xScaleDate,
        tooltip = this.tooltip,
        weekHook = this.weekHook

    // Reset scales and axes
    yScale.domain([0, util.getYMax(data)])
    // Assuming actual data has all the weeks
    let weeks = data.actual.map(d => d.week % 100)
    xScale.domain([0, weeks.length - 1])

    // Setup a scale for ticks
    let xScalePoint = d3.scalePoint()
        .domain(weeks)
        .range([0, this.width])

    // Week domain scale for easy mapping
    let xScaleWeek = (d) => xScale(weeks.indexOf(Math.floor(d))) + d % 1

    // Week to date parser
    let dateParser = d3.timeParse('%Y-%U')
    xScaleDate.domain(d3.extent(data.actual.map(d => {
      let formattedDate = Math.floor(d.week / 100) + '-' + d.week % 100
      return dateParser(formattedDate)
    })))

    let xAxis = d3.axisBottom(xScalePoint)
        .tickValues(xScalePoint.domain().filter((d, i) => !(i % 2)))

    let xAxisDate = d3.axisBottom(xScaleDate)
        .ticks(d3.timeMonth)
        .tickFormat(d3.timeFormat('%b %y'))

    let yAxis = d3.axisLeft(yScale)

    svg.select('.axis-x')
      .transition().duration(200).call(xAxis)

    svg.select('.axis-x-date')
      .transition().duration(200).call(xAxisDate)

    svg.select('.axis-y')
      .transition().duration(200).call(yAxis)

    // Save
    this.weeks = weeks
    this.xScaleWeek = xScaleWeek

    // Set pointer for week data (start with last)
    this.weekIdx = data.actual.length - 1
    this.weekHook({
      idx: this.weekIdx,
      name: this.weeks[this.weekIdx]
    })

    // Update markers with data
    this.timerect.plot(this, data.actual)
    this.baseline.plot(this, data.baseline)
    this.actual.plot(this, data.actual)

    // Reset history lines
    if (this.history) this.history.clear()
    this.history = new marker.HistoricalLines(this)
    this.history.plot(this, data.history)

    // Reset predictions
    this.predictions.map(p => p.clear())
    let colors = d3.scaleOrdinal(d3.schemeCategory10)

    data.models.forEach((m, idx) => {
      let predMarker = new marker.Prediction(this, m.id, colors(idx))
      predMarker.plot(this, m.predictions, data.actual)
      this.predictions.push(predMarker)
    })

    let that = this
    // Add mouse move and click events
    let bb = svg.node().getBoundingClientRect()
    d3.select('.overlay')
      .on('mousemove', function() {
        let mouse = d3.mouse(this)
        // Snap x to nearest tick
        let index = Math.round(xScale.invert(mouse[0]))
        let snappedX = xScale(index)
        d3.select('.hover-line')
          .transition()
          .duration(50)
          .attr('x1', snappedX)
          .attr('x2', snappedX)

        tooltip
          .style('top', (mouse[1] + bb.top) + 'px')
          .style('left', (mouse[0] + bb.left + 70) + 'px')
          .html(util.tooltipText(that, index))
      })
      .on('click', function() {
        let idx = Math.round(xScale.invert(d3.mouse(this)[0]))
        weekHook({
          idx: idx,
          name: weeks[idx]
        })
      })
  }

  /**
   * Update marker position
   */
  update(idx) {
    // Change self index
    this.weekIdx = idx
    this.timerect.update(idx)

    this.predictions.forEach(p => {
      p.update(idx)
    })
  }

  // External interaction functions
  // ------------------------------

  /**
   * Return next week idx and name for vuex store
   */
  getNextWeekData() {
    let nextIdx = Math.min(this.weeks.length - 1, this.weekIdx + 1)
    return {
      idx: nextIdx,
      name: this.weeks[nextIdx]
    }
  }

  /**
   * Return preview week idx and name for vuex store
   */
  getPreviousWeekData() {
    let previousIdx = Math.max(0, this.weekIdx - 1)
    return {
      idx: previousIdx,
      name: this.weeks[previousIdx]
    }
  }
}