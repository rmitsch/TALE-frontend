import NumericalHistogram from "./NumericalHistogram.js"

/**
 * Wrapper class for NumericalHistogram, changing some details in configuration of chart's data
 * binding.
 */
export default class RatingsHistogram extends NumericalHistogram
{
     /**
     *
     * @param name
     * @param panel
     * @param attributes
     * @param dataset
     * @param style
     * @param parentDivID
     */
    constructor(name, panel, attributes, dataset, style, parentDivID)
    {
        super(name, panel, attributes, dataset, style, parentDivID);
    }

    constructCFChart()
    {
        // Use operator's target ID as group name.
        this._cf_chart  = dc.barChart("#" + this._target, this._panel._operator._target);
        let d3Chart     = d3.select("#" + this._target);
        this._suppressNativeClickPropagation =
            this._suppressNativeClickPropagation === undefined ? true : this._suppressNativeClickPropagation;

        // Create shorthand references.
        let instance    = this;
        let extrema     = this._dataset._cf_extrema;
        let intervals   = this._dataset._cf_intervals;
        let dimensions  = this._dataset._cf_dimensions;
        let key         = this._axes_attributes.x + "#histogram";

        // Use padding so that first/last bar are not cut off in chart.
        let dataPadding = intervals[this._axes_attributes.x] * this._style.paddingFactor;

        // Configure chart.
        this._cf_chart
            .height(instance._style.height)
            .width(instance._style.width)
            .valueAccessor( d => {console.log(d); console.log(d.value.count); return d.value.count} )
            .keyAccessor(d => d.key)
            .elasticY(true)
            .x(d3.scale.linear().domain([
                extrema[instance._axes_attributes.x].min - dataPadding,
                extrema[instance._axes_attributes.x].max + dataPadding
            ]))
            // Add default padding to y-axis.
            .y(d3.scale.linear().domain([0, extrema[key].max]))
            .brushOn(true)
            // Filter on end of brushing action, not meanwhile (performance suffers otherwise).
            .filterOnBrushEnd(true)
            .dimension(dimensions[key])
            .group(this._dataset.cf_groups[key])
            .renderHorizontalGridLines(true)
            .margins({top: 0, right: 10, bottom: 16, left: 25})
            .gap(1)
            // Call cross-operator filter method on stage instance after filter event.
            .on("filtered", event => {
                //this._filteredIDs = this.propagateFilterChange(this, key);
                //this._panel._operator.filter(this._filteredIDs);
                //this._panel._operator.render();
            })
            .on('renderlet', function(chart) {
                // Suppress propagation of mouse click events.
                if (instance._suppressNativeClickPropagation) {
                    d3Chart.select(".brush").style({"pointer-events": "none"});

                    chart.selectAll('rect.bar')
                        .on('mouseover', function(d) {
                            d3.select(this).attr('fill', 'rgb(255, 0, 0)');
                        })
                        .on('mouseout', function(d) {
                            d3.select(this).attr('fill', 'rgb(31, 119, 180)');
                        });
                }
            });

        // Intercept mousedown so we can have both brush and mouseover.
        this._updateMouseDownListener();

        // Set number of ticks.
        if (instance._style.numberOfTicks.y !== "minmax")
            this._cf_chart.yAxis().ticks(instance._style.numberOfTicks.y);
        else
            this._cf_chart.yAxis().tickValues([0, extrema[key].max]);

        if (instance._style.numberOfTicks.x !== "minmax")
            this._cf_chart.xAxis().ticks(instance._style.numberOfTicks.x);
        else
            this._cf_chart.xAxis().tickValues([
                extrema[instance._axes_attributes.x].min,
                extrema[instance._axes_attributes.x].max
            ]);

        // Update bin width.
        const binWidth = this._dataset._cf_intervals[this._axes_attributes.x] / this._dataset._binCount;
        this._cf_chart.xUnits(dc.units.fp.precision(binWidth));
    }
}