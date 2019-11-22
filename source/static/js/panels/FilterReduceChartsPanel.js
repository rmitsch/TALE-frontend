import Panel from "./Panel.js";
import Utils from "../Utils.js";
import ParetoScatterplot from "../charts/ParetoScatterplot.js";
import NumericalHistogram from "../charts/NumericalHistogram.js";
import RatingsHistogram from "../charts/RatingsHistogram.js";
import CategoricalHistogram from "../charts/CategoricalHistogram.js";
import Dataset from "../data/DRMetaDataset.js";


/**
 * Panel holding scatterplots and histograms in operator FilterReduce.
 */
export default class FilterReduceChartsPanel extends Panel
{
    /**
     * Constructs new FilterReduce charts panel.
     * @param name
     * @param operator
     * @param parentDivID
     */
    constructor(name, operator, parentDivID)
    {
        super(name, operator, parentDivID);
        this._options = {
            binFraction: 10,
            plotOpacityBy: "threshold",
            plotOpacityMinCorrStrength: 0.3,
            plotOpacityOpacityUnderThreshold: 0.25,
            useLogs: false
        };

        // Update involved CSS classes.
        $("#" + this._target).addClass("filter-reduce-charts-panel");

        // Storage for current width and height.
        this._lastTargetWidth   = 0;
        this._lastTargetHeight  = 0;

        // Create div structure for child nodes.
        let divStructure        = this._createDivStructure();
        this._containerDivIDs   = divStructure.containerDivIDs;
        this._histogramDivIDs   = divStructure.histogramDivIDs;
        this._ratingsDivID      = divStructure.ratingsDivID;

        // Generate charts.
        this._correlationStrengths  = null;
        this._ratingsHistogram      = null;
        this._generateCharts();
    }

    /**
     * Generates all chart objects. Does _not_ render them.
     */
    _generateCharts()
    {
        console.log("Generating FilterReduceChartsPanel...");
        $("#logField").text("Generating FilterReduceChartsPanel...");

        // Define style options for charts.
        let histogramStyle = {
            showAxisLabels: false,
            // Use current container dimensions as size for chart.
            height: 65,
            width: $("#" + this._containerDivIDs["n_components"]).width(),
            paddingFactor: 0.15,
            excludedColor: "#ccc",
            numberOfTicks: {
                x: 2,
                y: 2
            },
            showTickMarks: true
        };

        // Define style options for charts.
        let scatterplotStyle = {
            showAxisLabels: {
                x: false,
                y: false
            },
            // Use current container dimensions as size for chart.
            height: 65,
            width: $("#" + this._containerDivIDs["n_components"]).width(),
            paddingFactor: 0.15,
            symbolSize: 1,
            excludedOpacity: 1,
            excludedSymbolSize: 1,
            excludedColor: "#ccc",
            numberOfTicks: {
                x: 3,
                y: 3
            },
            showAxisTickLabels: {
                x: false,
                y: false
            }
        };

        // Fetch reference to dataset.
        let dataset = this._operator._dataset;

        // -----------------------------------
        // Histograms.
        // -----------------------------------

        this._createHistograms(dataset, histogramStyle);

        // -----------------------------------
        // Create scatterplots.
        // -----------------------------------

        this._createScatterplots(dataset, scatterplotStyle);

        // -----------------------------------
        // Set correlation bars to initial
        // values.
        // -----------------------------------

        this._operator._dataset.computeCorrelationStrengths(results => this.updateCorrelationBars(results));

        // -----------------------------------
        // Create ratings box.
        // -----------------------------------

        histogramStyle.height           = 100;
        histogramStyle.width            = 200;
        histogramStyle.showAxisLabels   = true;
        histogramStyle.numberOfTicks = {
            x: 4,
            y: 4
        };

        this._ratingsHistogram = new RatingsHistogram(
            "rating.histogram",
            this,
            ["rating"],
            this._operator.dataset,
            histogramStyle,
            // Place chart in previously generated container div.
            this._ratingsDivID
        );
        this._ratingsHistogram.render();
        // Set event listener for change of value for showing unrated embeddings.
        $("#ratingsShowAllCheckbox").change(() => this._ratingsHistogram.toggleShowingUnrated());
    }

    /**
     * Updates histogram for embedding ratings after update.
     * @param context
     * @param embeddingID
     * @param rating
     */
    updateRatingsHistogram(context, embeddingID, rating)
    {
        context._ratingsHistogram.render();
    }

    /**
     * Creates histograms for this panel.
     * @param dataset
     * @param style
     * @private
     */
    _createHistograms(dataset, style)
    {
        // Iterate over all attributes.
        // Unfold names of hyperparamater objects in list.
        let hyperparameters = Utils.unfoldHyperparameterObjectList(dataset.metadata.hyperparameters);
        let attributes = hyperparameters.concat(dataset.metadata.objectives);
        for (let i = 0; i < attributes.length; i++) {
            let attribute               = attributes[i];
            let histogram               = null;
            let updatedStyle            = $.extend(true, {}, style);

            // If attributes is objective or numerical hyperparameter: Spawn NumericalHistogram.
            if (
                (
                    i < hyperparameters.length &&
                    dataset.metadata.hyperparameters[i].type === "numeric"
                ) ||
                i >= hyperparameters.length
            ) {
                // Generate numerical histogram.
                histogram = new NumericalHistogram(
                    attribute + ".histogram",
                    this,
                    [attribute],
                    dataset,
                    updatedStyle,
                    // Place chart in previously generated container div.
                    this._histogramDivIDs[attribute]
                );
            }

            // Otherwise: Spawn categorical histogram.
            else {
                // Generate categorical histogram.
                histogram = new CategoricalHistogram(
                    attribute + ".histogram",
                    this,
                    [attribute],
                    dataset,
                    updatedStyle,
                    // Place chart in previously generated container div.
                    this._histogramDivIDs[attribute]
                );
            }

            this._charts[histogram.name] = histogram;
            histogram.render();
        }
    }

    /**
     * Create histograms for this panel.
     * @param dataset
     * @param style
     * @private
     */
    _createScatterplots(dataset, style)
    {
        // -----------------------------------
        // 1. Hyperparameter-objective combinations.
        // ----------------------------f-------

        this._createHyperparameterObjectiveScatterplots(dataset, style, true);

        // -----------------------------------
        // 2. Objective-objective combinations.
        // -----------------------------------

        this._createObjectiveObjectiveScatterplots(dataset, style, true);
    }

    /**
     * Creates hyperparameter-objective scatterplots.
     * @param dataset
     * @param style
     * @param render Flag determining whether plots should be rendered immediately.
     * @private
     */
    _createHyperparameterObjectiveScatterplots(dataset, style, render)
    {
        // Iterate over hyperparameter.
        let hyperparameterIndex = 0;
        for (let hyperparameter of dataset.metadata.hyperparameters) {
            let objectiveIndex = 0;
            // Iterate over objectives.
            for (let objective of dataset.metadata.objectives) {
                // Adapt style settings, based on whether this is the first scatterplot or not.
                let updatedStyle                    = $.extend(true, {}, style);
                updatedStyle.showAxisTickLabels.y   = hyperparameterIndex === 0;
                updatedStyle.showAxisTickLabels.x   = objectiveIndex === dataset.metadata.objectives.length - 1;

                // Instantiate new scatterplot.
                let scatterplot = new ParetoScatterplot(
                    hyperparameter.name + ":" + objective,
                    this,
                    // If hyperparameter is categorical: Use suffix "*" to enforce usage of numerical
                    // representation.
                    [
                        hyperparameter.name + (hyperparameter.type === "categorical" ? "*" : ""),
                        objective
                    ],
                    dataset,
                    updatedStyle,
                    // Place chart in previously generated container div.
                    this._containerDivIDs[hyperparameter.name]
                );

                this._charts[scatterplot.name] = scatterplot;
                if (render)
                    scatterplot.render();

                objectiveIndex++;
            }

            hyperparameterIndex++;
        }
    }

    /**
     * Creates objective-objective scatterplots.
     * @param dataset
     * @param style
     * @param render Flag determining whether plots should be rendered immediately.
     * @private
     */
    _createObjectiveObjectiveScatterplots(dataset, style, render)
    {
        // Iterate over objectives.
        for (let i = 0; i < dataset.metadata.objectives.length; i++) {
            let objective1 = dataset.metadata.objectives[i];

            // Iterate over objectives.
            for (let j = i + 1; j < dataset.metadata.objectives.length; j++) {
                let objective2 = dataset.metadata.objectives[j];

                // Adapt style settings, based on whether this is the first scatterplot or not.
                let updatedStyle                    = $.extend(true, {}, style);
                updatedStyle.showAxisTickLabels.x   = j === dataset.metadata.objectives.length - 1;

                // Instantiate new scatterplot.
                let scatterplot = new ParetoScatterplot(
                    objective1 + ":" + objective2,
                    this,
                    [objective1, objective2],
                    dataset,
                    updatedStyle,
                    // Place chart in previously generated container div.
                    this._containerDivIDs[objective1],
                    // Draw hexagonal heatmap, hence don't draw any points.
                    true
                );

                // Render.
                this._charts[scatterplot.name] = scatterplot;
                // Render scatterplot.
                if (render)
                    scatterplot.render();
            }
        }
    }

    /**
     * Create (hardcoded) div structure for child nodes.
     * @returns {Object}
     */
    _createDivStructure()
    {
        let scope           = this;
        let containerDivIDs = {};
        let histogramDivIDs = {};
        let dataset         = this._operator._dataset;

        // Create row labels.
        let labelContainer = Utils.spawnChildDiv(this._target, null, 'filter-reduce-labels-container');
        // Add labels to container.
        for (let objective of dataset.metadata.objectives) {
            let label = Utils.spawnChildDiv(
                labelContainer.id, "filter-reduce-row-label-" + objective, 'filter-reduce-row-label'
            );
            Utils.spawnChildSpan(
                label.id,
                null,
                'filter-reduce-row-label-text',
                Dataset.translateAttributeNames()[objective]
            );
        }

        // -----------------------------------
        // Create ratings box.
        // -----------------------------------

        let ratingsBox = Utils.spawnChildDiv(
            this._target, "embeddings-ratings-box", null, "" +
            "<div class='box-title'>User Ratings</div>" +
            "<div>" +
            "   <span>Show unrated?</span>" +
            "   <label class='switch'>" +
    	    "       <input class='switch-input' id='ratingsShowAllCheckbox' type='checkbox' />" +
    	    "       <span class='switch-label' data-on='Yes' data-off='No'></span>" +
            "       <span class='switch-handle'></span>" +
            "   </label>" +
            "   <div id='embeddings-ratings-box-chart'></div>" +
            "</div>"
        );

        // -----------------------------------
        // Create container divs.
        // -----------------------------------

        // Unfold names of hyperparamater objects in list.
        let hyperparameters = Utils.unfoldHyperparameterObjectList(dataset.metadata.hyperparameters);

        // Iterate over all attributes.
        let i = 0;
        for (let attribute of hyperparameters.concat(dataset.metadata.objectives)) {
            let div = Utils.spawnChildDiv(
                this._target, null, "filter-reduce-charts-container"
            );
            containerDivIDs[attribute] = div.id;

            // Add column label/title.
            let titleDiv = Utils.spawnChildDiv(
                div.id,
                "filter-reduce-title-" + attribute,
                dataset.metadata.objectives.includes(attribute) ? "title objective" : "title hyperparameter",
                Dataset.translateAttributeNames()[attribute]
            );
            // Place column title accordingly.
            let numberOfPlaceholders = Math.max(i - hyperparameters.length + 1, 0);
            $("#" + titleDiv.id).css({"top": (-25 + 70 * numberOfPlaceholders)  + "px"});

            // If this is a histogram for an objective-objective plot: Fill slots with placeholders to move obj.-obj.
            // to push histograms onto the diagonale.
            for (let k = i - hyperparameters.length; k >= 0; k--) {
                Utils.spawnChildDiv(div.id, null, "chart-placeholder");
            }

            // Add div for histogram.
            histogramDivIDs[attribute] = Utils.spawnChildDiv(div.id, null, "histogram").id;

            // Keep track of number of processed attributes.
            i++;
        }

        // -----------------------------------
        // Create title and options container.
        // -----------------------------------

        // Note: Listener for table icon is added by FilterReduceOperator, since it requires information about the table
        // panel.
        let infoDiv = Utils.spawnChildDiv(this._target, null, "panel-info filter-reduce-info");
        $("#" + infoDiv.id).html(
            "<span class='title'>" + scope._name + "</span>" +
            "<a id='filter-reduce-info-settings-icon' href='#'>" +
            "    <img src='./static/img/icon_settings.png' class='info-icon' alt='Settings' width='20px'>" +
            "</a>"
        );

        return {
            containerDivIDs: containerDivIDs,
            histogramDivIDs: histogramDivIDs,
            ratingsDivID: "embeddings-ratings-box-chart"
        };
    }

    resize()
    {
        // Note: Case of height and width adjustment at the same time should not occur.
        let target          = $("#" + this._target);
        const targetWidth   = target.width();
        const targetHeight  = target.height();
        let metadata        = this._operator.dataset.metadata;

        // Adjust width, if necessary.
        if (targetWidth !== this._lastTargetWidth) {
            const targetChartWidth = ((targetWidth - 75) / (metadata.objectives.length + metadata.hyperparameters.length));

            // Resize container divs' width.
            $(".filter-reduce-charts-container").css("width", targetChartWidth + "px")

            // Resize placeholders.
            $(".chart-placeholder").css("width", targetChartWidth + "px");

            // Resize charts' width.
            for (let chartName in this._charts) {
                this._charts[chartName].resize(-1, targetChartWidth);
            }

            this._lastTargetWidth = targetWidth;
        }

        // Adjust height, if necessary.
        if (targetHeight !== this._lastTargetHeight) {
            const chartContainerHeight  = $("#" + this._containerDivIDs[Object.keys(this._containerDivIDs)[0]]).height();
            let chartHeight             = Math.floor(
                (chartContainerHeight - 20) / (this._operator.dataset.metadata.objectives.length + 1)
            );
            $(".chart-placeholder").css("height", chartHeight + "px");

            // Resize charts.
            for (let chartName in this._charts) {
                this._charts[chartName].resize(chartHeight);
            }

            // Reposition chart column and row titles.
            for (let i = 0; i < metadata.objectives.length; i++) {
                $("#filter-reduce-title-" + metadata.objectives[i]).css({"top": (-25 + (chartHeight + 5) * (i + 1))  + "px"});
            }
            $(".filter-reduce-labels-container").css("margin-top", (chartHeight + 10) + "px");
            $(".filter-reduce-row-label").css("margin-bottom", (chartHeight - 6) + "px");
            $(".filter-reduce-row-label-text").css("padding-top", (chartHeight / 2) + "px");

            this._lastTargetHeight = targetHeight;
        }
    }


    /**
     * Updates options object and charts in accordance with changed options.
     * @param options
     */
    set options(options)
    {
        // SSP binning.
        if (
            this._options.binFraction !== options.binFraction ||
            this._options.useLogs !== options.useLogs
        ) {
            for (const chartName in this._charts) {
                // Consider only SSPs without binning, i. e. HP-objective plots.
                if (!chartName.includes("histogram")) {
                    const chartAttributes = chartName.split(":");
                    if (chartAttributes.length === 2 && chartAttributes[0] !== chartAttributes[1])
                        this._charts[chartName].updateSSPBinning(options);
                }
            }
        }

        // Update opacity.
        this._updatePlotOpacities(options);

        this._options = options;
    }

    /**
     * Update SSPs' opacities.
     * @param options
     * @param forceUpdate Updates even if options haven't changed.
     * @private
     */
    _updatePlotOpacities(options, forceUpdate = false)
    {
        if (
            forceUpdate ||
            this._options.plotOpacityBy !== options.plotOpacityBy ||
            this._options.plotOpacityMinCorrStrength !== options.plotOpacityMinCorrStrength ||
            this._options.plotOpacityOpacityUnderThreshold !== options.plotOpacityOpacityUnderThreshold
        ) {
            for (const chartName in this._charts) {
                // Ignore histograms.
                if (!chartName.includes("histogram")) {
                    const attributes            = chartName.split(":");
                    const correlationStrength   = this._correlationStrengths[attributes[0]][attributes[1]];
                    const animationDuration     = 1000;
                    let chart                   = $("#" + this._charts[chartName]._target);

                    if (options.plotOpacityBy === "corrStrength")
                        chart.animate({"opacity": correlationStrength}, animationDuration);
                    else if (options.plotOpacityBy === "threshold") {
                        if (correlationStrength < options.plotOpacityMinCorrStrength)
                            chart.animate({"opacity": options.plotOpacityOpacityUnderThreshold}, animationDuration);
                        else
                            chart.animate({"opacity": 1}, animationDuration);
                    }
                }
            }
        }
    }

    /**
     * Updates ID filtering in SSPs after selection.
     * Necessary after change to ID-based filtering introduced to enable series-based selection.
     * Candidate for refactoring - ID handling could be simplified. Considered low-priority at this stag though.
     * @param filteredIDs
     * @param scatterplotID
     */
    updateIDsToFilterInSSPs(filteredIDs, scatterplotID)
    {
        // Consider only SSPs.
        for (const chartName in this._charts) {
            // Consider only SSPs without binning, i. e. HP-objective plots.
            if (!chartName.includes("histogram")) {
                const chartAttributes = chartName.split(":");
                if (
                    chartName !== scatterplotID &&
                    chartAttributes.length === 2 &&
                    chartAttributes[0] !== chartAttributes[1]
                ) {
                    this._charts[chartName]._cf_chart.identifyFilteredRecords(
                        d => filteredIDs !== null ? filteredIDs.has(d[2]) : true
                    );
                }
            }
        }
    }

    /**
     * Updates correlation bars after change in filter selection has been processed in backend.
     * @param results
     */
    updateCorrelationBars(results)
    {
        this._correlationStrengths = results;

        for (const chartName in this._charts) {
            // Ignore histograms.
            if (!chartName.includes("histogram")) {
                if (chartName.split(":").length === 2)
                    this._charts[chartName].updateCorrelationBar(results);
            }
        }

        this._updatePlotOpacities(this._options, true);
    }

    render()
    {
        for (const chartName in this._charts) {
            this._charts[chartName].render();
        }

        this._operator._dataset.computeCorrelationStrengths(results => this.updateCorrelationBars(results));
    }

     /**
      * Updates data and buffered filter data after selection has been made in table panel.
      * @param embeddingIDs
      */
    updateFilteredRecordBuffer(embeddingIDs)
    {
        // Ignore histograms, since they don't have buffered record IDs.
        for (const chartName in this._charts) {
            if (!chartName.includes("histogram")) {
                if (chartName.split(":").length === 2)
                    this._charts[chartName].updateFilteredRecordBuffer(embeddingIDs);
            }
        }
    }
}
