import Panel from "./Panel.js";
import Utils from "../Utils.js";
import DRMetaDataset from "../data/DRMetaDataset.js";


/**
 * Panel holding charts for surrogate model in SurrogateModelOperator.
 */
export default class ExplainerPanel extends Panel
{
    /**
     * Constructs new FilterReduce charts panel.
     * Note that no CF interaction happens in this panel - it's read only.
     * @param name
     * @param operator
     * @param parentDivID
     */
    constructor(name, operator, parentDivID)
    {
        super(name, operator, parentDivID);

        this._chart = null;

        // Update involved CSS classes.
        $("#" + this._target).addClass("explainer-panel");

        // Determine color scheme, color domain.
        this._colorScheme   = [
            '#a50f15', '#de2d26', '#fb6a4a', '#fcae91', '#fee5d9',
            "#ffffff", '#bdd7e7', '#6baed6', '#3182bd', '#08519c'
        ];
        this._colorDomain   = ExplainerPanel._calculateColorDomain({min: -1, max: 1}, this._colorScheme);
        this._colors        = d3.scale.linear().domain(this._colorDomain).range(this._colorScheme);

        // Create div structure for child nodes.
        this._divStructure = this._createDivStructure();

        // Generate charts.
        this._charts = {};
        this._generateCharts();
    }

    /**
     * Calculates color domain based on existing color scheme and data extrema.
     * @param extrema
     * @param colorScheme
     * @returns {number[]}
     * @private
     */
    static _calculateColorDomain(extrema, colorScheme)
    {
        let colorDomain = [];

        colorScheme.forEach(
            (color, i) => colorDomain.push(extrema.min + ((extrema.max - extrema.min) / colorScheme.length * i))
        );

        return colorDomain;
    }

    /**
     * Generates all chart objects. Does _not_ render them.
     */
    _generateCharts()
    {
        console.log("Generating ExplainerPanel...");
        $("#logField").text("Generating Explainer...");

        const attribute     = "objective:hyperparameter";
        const dataset       = this._operator._dataset;
        const explainerPane = $("#" + this._divStructure.chartContainerID);

        // Initialize explainer heatmap.
        this._charts["explainerHeatmap"] = dc.heatMap(
            "#" + this._divStructure.chartContainerID,
            // Use operator's target ID as group name.
            this._operator._target
        );

        this._charts["explainerHeatmap"]
            .height(explainerPane.height())
            .width(explainerPane.width())
            .dimension(dataset._cf_dimensions[attribute])
            .group(dataset._cf_groups[attribute])
            .colorAccessor(d => d.value.avg)
            .colors(
                this._colors
            )
            .keyAccessor(d => d.key[0])
            .valueAccessor(d => { return d.key[1]})
            // .title(d => scope._explanationRuleLookup[d.key[1]][d.key[0]])
            .colsLabel(d => DRMetaDataset.translateAttributeNames(false)[d])
            .rowsLabel(d => DRMetaDataset.translateAttributeNames(false)[d])
            .margins({top: 0, right: 20, bottom: 48, left: 60})
            .transitionDuration(0)
            .xBorderRadius(0)
            // Rotate labels.
            .on('pretransition', function(chart) {
                chart
                    .selectAll('g.cols.axis > text')
                    .attr('transform', function (d) {
                        let coord = this.getBBox();
                        let x = coord.x + (coord.width/2) + coord.height * 1.5,
                            y = coord.y + (coord.height/2) * 5;

                        return "rotate(-50 "+ x + " " + y + ")"
                    });
            });
        this._charts["explainerHeatmap"].render();
    }

    /**
     * Create (hardcoded) div structure for child nodes.
     * @returns {Object}
     * @private
     */
    _createDivStructure()
    {
        let scope = this;

        // -----------------------------------
        // Create color legend.
        // -----------------------------------

        let paletteDiv      = Utils.spawnChildDiv(this._target, null, "color-palette");
        const numSteps      = 5;

        let colorToPaletteCellMap = {};
        for (let i = numSteps - 1; i > -numSteps; i--) {
            const value                     = i / numSteps;
            let color                       = this._colors(value);
            let cell                        = Utils.spawnChildDiv(paletteDiv.id, null, "color-palette-cell");
            colorToPaletteCellMap[color]    = cell.id;

            // Set color and height of cell.
            const cellDiv = $("#" + cell.id);
            cellDiv.css("background-color", color);
            cellDiv.css("height", (1 / (numSteps * 2 - 1) * 100) + "%");

            // Create labels indicating color <-> percentage mapping.
            if (i === numSteps - 1 ||
                i === -numSteps + 1 ||
                Math.abs(i) === Math.floor(numSteps / 2) ||
                i === 0
            ) {
                Utils.spawnChildSpan(cell.id, null, "color-palette-label", (value * 100) + "%");
            }
        }

        // -----------------------------------
        // Create chart container.
        // -----------------------------------

        let chartContainer = Utils.spawnChildDiv(this._target, null, "explainer-charts-container");

        // -----------------------------------
        // Create title and options container.
        // -----------------------------------

        let infoDiv = Utils.spawnChildDiv(this._target, null, "panel-info");
        $("#" + infoDiv.id).html("<span class='title'>" + scope._name + "</span>");

        return {
            chartContainerID: chartContainer.id,
            colorPaletteDivID: paletteDiv.id
        };
    }

    render()
    {
        this._charts["explainerHeatmap"].render();
    }

    resize()
    {
        const explainerPane         = $("#" + this._divStructure.chartContainerID);
        const explainerPaneHeight   = explainerPane.height();
        this._charts["explainerHeatmap"]
            .height(explainerPaneHeight - 18)
            .width(explainerPane.width());
        this._charts["explainerHeatmap"].render();

        // Adjust color scale height.
        $("#" + this._divStructure.colorPaletteDivID).height(explainerPaneHeight - 70);
        // Adjust color scale's labels' positions.
        for (let label of $(".color-palette-label")) {
            let labelElement = $("#" + label.id);
            labelElement.css("top", labelElement.parent().height() / 2 - labelElement.height() / 2);
        }
    }

    processSettingsChange(delta)
    {
    }

    highlight(id, source, propagate = false)
    {
    }
}