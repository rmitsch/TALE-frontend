import NumericalHistogram from "./NumericalHistogram.js"
import Utils from "../Utils.js";

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

        this._showUnrated = false;
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
            .valueAccessor( d => d.value.count)
            .keyAccessor(d => d.key)
            .elasticY(true)
            .x(d3.scale.linear().domain([1, 6]))
            // Add default padding to y-axis.
            .y(d3.scale.linear().domain([0, extrema[key].max]))
            .brushOn(true)
            // Filter on end of brushing action, not meanwhile (performance suffers otherwise).
            .filterOnBrushEnd(true)
            .dimension(dimensions[key])
            .group(this._dataset.cf_groups[key])
            .renderHorizontalGridLines(true)
            .margins({top: 5, right: 10, bottom: 16, left: 40})
            .gap(1)
            .transitionDuration(0)
            // Call cross-operator filter method on stage instance after filter event.
            .on("filtered", event => {
                this._filteredIDs = this.propagateFilterChange(this, key);
                this._panel._operator.filter(this._filteredIDs);
                this._panel._operator.render();
            })
            .on('renderlet', function(chart) {
                // Suppress propagation of mouse click events.
                if (instance._suppressNativeClickPropagation) {
                    d3Chart.select(".brush").style({"pointer-events": "none"});

                    chart.selectAll('rect.bar')
                        .on('mouseover', d => {
                            d3.select(d3.event.target).attr('fill', 'rgb(255, 0, 0)');
                        })
                        .on('mouseout', d => {
                            d3.select(d3.event.target).attr('fill', 'rgb(31, 119, 180)');
                        });
                }
            });
        
        // Intercept mousedown so we can have both brush and mouseover.
        this._updateMouseDownListener();

        // Configure ticks.
        this._cf_chart.yAxis().ticks(2);
        this._cf_chart.xAxis().tickValues([1, 2, 3, 4, 5]);
        this._cf_chart.xAxis().tickFormat(d3.format('d'));
        this._cf_chart.yAxis().tickFormat(d3.format('d'));

        // Update bin width.
        this._cf_chart.xUnits(dc.units.fp.precision(1));
    }

    /**
     * Updates chart w.r.t. whether unrated records should be shown.
     */
    toggleShowingUnrated()
    {
        this._showUnrated = !this._showUnrated;

        if (this._showUnrated)
            this._cf_chart.x(d3.scale.linear().domain([0, 6]));
        else
            this._cf_chart.x(d3.scale.linear().domain([1, 6]));

        this._cf_chart.render();
    }
}