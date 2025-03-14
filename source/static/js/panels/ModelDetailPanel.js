import Panel from "./Panel.js";
import Utils from "../Utils.js";
import DRMetaDataset from "../data/DRMetaDataset.js";
import ModelDetailTable from "../charts/ModelDetailTable.js";
import HexagonalHeatmap from "../charts/HexagonalHeatmap.js";
import ModelDetailSettingsPanel from "./settings/ModelDetailSettingsPanel.js";
import CorankingMatrix from "../charts/CorankingMatrix.js";


/**
 * Panel for model detail view.
 */
export default class ModelDetailPanel extends Panel
{
    /**
     * Constructs new panel for model detail view charts.
     * @param name
     * @param operator
     * @param parentDivID
     */
    constructor(name, operator, parentDivID)
    {
        super(name, operator, parentDivID);

        this._hasLoaded             = false;
        this._sparklineValues       = null;

        // Colorcoding-related attributes.
        this._colorcodingSPSelectID         = 'embedding-details-scatterplots-colorcoding-select';
        this._colorcodingSPOptionsAreSet    = false;

        // Store information on split positions.
        this._lastSplitPositions    = {};
        this._splits                = {};

        // Initialize (empty) set of filtered record IDs.
        this._filteredRecordIDs     = new Set();

        // Update involved CSS classes.
        $("#" + this._target).addClass("model-detail-panel");

        // Keep a copy of currently used colorizing methods for scatterplots in case a reset due to highlighting changes
        // is needed.
        this._scatterplotColorizingMethods = {colorAccessor: null, colors: null};

        // Remember last position of highlighted record.
        this._lastHighlightedPositions = {};

        // Generate settings panel.
        this._settingsPanel = new ModelDetailSettingsPanel(
            "Model Detail View: Settings", this._operator, this, null, null
        );
        // Remember settings to decide when to redraw which charts.
        this._optionValues  = this._settingsPanel.optionValues;

        // Create div structure for child nodes.
        this._divStructure  = this._createDivStructure();

        // Dictionary for lookup of explainer rules.
        this._explanationRuleLookup = {};

        // Generate charts.
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
        console.log("Generating ModelDetailPanel...");
        $("#logField").text("Generating ModelDetailPanel...");

        // Initialize table.
        this._charts["table"] = null;

        // Initialize explainer heatmap.
        this._charts["explainerHeatmap"] = dc.heatMap(
            "#" + this._divStructure.explainerPaneID,
            // Use operator's target ID as group name.
            this._operator._target
        );
    }

    /**
     * Returns content structure for info div.
     * @return string Info div structure for info div.
     * @private
     */
    _generateInfoDivContent()
    {
        return "<span class='title' id='model-detail-title'></span>" +
            "<a id='model-detail-settings-icon' href='#'>" +
            "    <img src='./static/img/icon_settings.png' class='info-icon' alt='Settings' width='20px'>" +
            "</a> " +
            "<span class='embedding-rating' data-rateit-mode='font'></span>";
    }

    /**
     * Extracts dictionary {hyperparameter -> {objective -> rule}} from loaded dataset.
     * Stores result in this._explanationRuleLookup.
     * @private
     */
    _updateExplanationRuleLookup()
    {
        for (let rule of this._data._preprocessedExplanationData) {
            if (!(rule.hyperparameter in this._explanationRuleLookup)) {
                this._explanationRuleLookup[rule.hyperparameter] = {};
            }

            this._explanationRuleLookup[rule.hyperparameter][rule.objective] = rule.hyperparameter + " to " + rule.objective + ": " + rule.weight;
        }
    }

    /**
     * Create (hardcoded) div structure for child nodes.
     * @returns {Object}
     */
    _createDivStructure()
    {
        let instance = this;

        // -----------------------------------
        // 1. Create panes.
        // -----------------------------------

        Utils.spawnChildDiv(
            this._target,
            "model-detail-not-loaded-indicator",
            null,
            "<span>Please select an embedding by double-clicking one of the rows in the table at the bottom left.</span>"
        );

        let infoDiv             = Utils.spawnChildDiv(this._target, null, "panel-info model-detail-panel-info");
        $("#" + infoDiv.id).html(this._generateInfoDivContent());

        let contentPane         = Utils.spawnChildDiv(this._target, "model-detail-content-pane");

        // Left pane.
        let parameterPane       = Utils.spawnChildDiv(contentPane.id, "model-detail-parameter-pane", "split split-horizontal");
        // Center pane.
        let samplePane          = Utils.spawnChildDiv(contentPane.id, "model-detail-sample-pane", "split split-horizontal");
        // Right pane.
        let dimRedAnalyticsPane = Utils.spawnChildDiv(contentPane.id, "model-detail-dimred-pane", "split split-horizontal");

        // 1. Upper-left pane - hyperparameters and objectives for current DR model.
        let attributePane = Utils.spawnChildDiv(
            parameterPane.id, null, "model-detail-pane split split-vertical",
            `<div class='model-details-block'>
                <div class='model-details-title'>Hyperparameters</div>
                <div id="model-details-block-hyperparameter-content"></div>
                <div class='model-details-title'>Metrics</div>
                <div id="model-details-block-objective-content"></div>
            </div>`
        );

        // 2. Bottom-left pane - explanation of hyperparameter importance for this DR model.
        let explainerPane = Utils.spawnChildDiv(
            parameterPane.id, null, "model-detail-pane split-vertical",
            `<div class='model-details-block'>
                <div class='model-details-title'>Local Hyperparameter Influence</div>
                <div id="model-details-explainer-pane"</div>
            </div>`
        );

        // 3. Upper-center pane - all records in scatterplot.
        let scatterplotPane = Utils.spawnChildDiv(
            samplePane.id, null, "model-detail-pane split-vertical"
        );

        // 4. Bottom-center pane - detailed information to currently selected record.
        let recordPane = Utils.spawnChildDiv(
            samplePane.id, null, "model-detail-pane split-vertical",
            `<div class='model-details-block' id='model-details-block-record-table'>
                <div class='model-details-title'>Selected Sample(s)</div>
            </div>`
        );

        // 5. Upper-right pane - Shepard diagram.
        let shepardPane = Utils.spawnChildDiv(
            dimRedAnalyticsPane.id, null, "model-detail-pane split-vertical",
            `<div class='model-details-block' id='model-details-block-shepard-diagram'>
                <div class='model-details-title'>Distance Divergence</div>
                <div id="shepard-diagram"></div>
            </div>`
        );

        // 6. Lower-right pane - Coranking matrix.
        let corankingPane = Utils.spawnChildDiv(
            dimRedAnalyticsPane.id, null, "model-detail-pane split-vertical",
            `<div class='model-details-block' id='model-details-block-coranking-matrix'>
                <div class='model-details-title'>Neighbourhood Divergence</div>
                <div id="coranking-matrix"></div>
            </div>`
        );

        // -----------------------------------
        // 2. Configure splitting.
        // -----------------------------------

        // Split left, center and right pane.
        this._lastSplitPositions["all"] = [25, 50, 25];
        this._splits["all"] = Split(["#" + parameterPane.id, "#" + samplePane.id, "#" + dimRedAnalyticsPane.id], {
            direction: "horizontal",
            sizes: this._lastSplitPositions["all"],
            minSize: 0,
            onDragEnd: () => {
                instance.resize();
            }
        });

        // Split upper-left and bottom-left pane.
        this._lastSplitPositions["left"] = [40, 60];
        this._splits["left"] = Split(["#" + attributePane.id, "#" + explainerPane.id], {
            direction: "vertical",
            sizes: this._lastSplitPositions["left"],
            minSize: 0,
            onDragEnd: () => {
                instance.resize();
            }
        });

        // Split upper-center and bottom-center pane.
        this._lastSplitPositions["middle"] = [50, 50];
        this._splits["middle"] = Split(["#" + scatterplotPane.id, "#" + recordPane.id], {
            direction: "vertical",
            sizes: this._lastSplitPositions["middle"],
            minSize: 0,
            onDragEnd: () => {
                instance.resize();
            }
        });

        // Split upper-right and bottom-right pane.
        this._lastSplitPositions["right"] = [50, 50];
        this._splits["right"] = Split(["#" + shepardPane.id, "#" + corankingPane.id], {
            direction: "vertical",
            sizes: this._lastSplitPositions["right"],
            minSize: 0,
            onDragEnd: () => {
                instance.resize();
            }
        });

        // Return all panes' IDs.
        return {
            infoDivID: infoDiv.id,
            parameterPaneID: parameterPane.id,
            samplePaneID: samplePane.id,
            dimRedAnalyticsPaneID: dimRedAnalyticsPane.id,
            attributePane: {
                id: attributePane.id,
                hyperparameterContentID: "model-details-block-hyperparameter-content",
                objectiveContentID: "model-details-block-objective-content",
            },
            explainerPaneID: "model-details-explainer-pane",
            scatterplotPaneID: scatterplotPane.id,
            recordPane: {
                id: recordPane.id,
                tableID: "model-details-block-record-table"
            },
            shepardPaneID: shepardPane.id,
            corankingPaneID: corankingPane.id
        };
    }

    render()
    {
        if (!this._hasLoaded)
            return;
        let scope = this;

        // Fade out placeholder screen and show tour after first load.
        const placeholderScreen = $("#model-detail-not-loaded-indicator");
        if (placeholderScreen.css("display") === "block") {
            placeholderScreen.fadeTo(1000, 0, () => placeholderScreen.css("display", "none"));

            let scope = this;
            let intro = introJs();
            intro.setOptions({
                steps: [
                    {
                        element: "#" + scope._target,
                        intro: "This tour will guide you through the <b>embedding detail view</b>. It offers " +
                            "elements designed to help you assess an embedding's quality."
                    },
                    {
                        element: $(".embedding-rating")[0],
                        intro: "The current rating of the embedding is shown here. Assign a rating based on your " +
                            "subjective impression of this embedding's quality by clicking one of the stars."
                    },
                    {
                        element: "#" + scope._divStructure.attributePane.id,
                        intro: "The selected embedding's hyperparameter & objective values are shown here.",
                        position: "right"
                    },
                    {
                        element: "#" + scope._divStructure.explainerPaneID,
                        intro: "Similar to the 'Subset Hyperparameter Influence' view, this visualizes the effect of " +
                            "hyperparameters on objectives for the selected embedding.",
                        position: "right"
                    },
                    {
                        element: "#" + scope._divStructure.scatterplotPaneID,
                        intro: "The low-dimensional/embedded representation of the records in the embedded dataset. " +
                            "If there are more than two dimensions, a scatterplot matrix is shown: First vs. second " +
                            "dimension, first vs. third, second vs. third etc. <br>One point represents one record in the " +
                            "original, high-dimensional dataset. <br><br>The dropdown at the bottom left allows to color " +
                            "records by their attributes.",
                        position: "bottom"
                    },
                    {
                        element: "#" + scope._divStructure.recordPane.tableID,
                        intro: "This table shows all records in the dataset. Records are highlighted in the scatterplots " +
                            "above when hovered over. Records can be filtered by the histograms located at the table " +
                            "header.",
                        position: "top"
                    },
                    {
                        element: "#shepard-diagram",
                        intro: "The Shepard diagram shows how well the distances between points have been maintained " +
                            "during the dimensionality reduction. An ideal preservation results in a straight line of 45 " +
                            "degrees from the bottom left to the top right.",
                        position: "left"
                    },
                    {
                        element: "#coranking-matrix",
                        intro: "The co-ranking matrix is the rankwise equivalent to the Shepard diagram. A perfect " +
                            "embedding has full cells along the diagonale from the top left to the bottom right " +
                            "and empty cells everywhere else.",
                        position: "left"
                    },
                    {
                        element: "#" + scope._target,
                        intro: "Thanks for taking the tour! You may start selecting and rating interesting embeddings now."
                    }
                ],
                showStepNumbers: false,
                disableInteraction: true,
                exitOnOverlayClick: false,
                keyboardNavigation: true,
                hideNext: true,
                showProgress: true,
                exitOnEsc: true
            });
            intro.start();
        }

        // -------------------------------------------------------
        // 1. Draw sparklines for attributes.
        // -------------------------------------------------------

        this._redrawAttributeSparklines();

        // -------------------------------------------------------
        // 2. Draw scatterplot/SPLOM showing individual records.
        // -------------------------------------------------------

        this._redrawRecordScatterplots();

        // -------------------------------------------------------
        // 3. Draw Shepard diagram.
        // -------------------------------------------------------

        this._redrawShepardDiagram();

        // -------------------------------------------------------
        // 4. Draw heatmap for co-ranking matrix.
        // -------------------------------------------------------

        this._redrawCorankingmatrix();

        // -------------------------------------------------------
        // 5. Update table.
        // -------------------------------------------------------

        this._reconstructTable();

        // -------------------------------------------------------
        // 6. Draw explainer matrix.
        // -------------------------------------------------------

        this._redrawAttributeInfluenceHeatmap();

        // Update panel size.
        const panelDiv = $("#" + this._target);
        this._lastPanelSize = {width: panelDiv.width(), height: panelDiv.height()};
    }

    _redrawAttributeInfluenceHeatmap()
    {
        let scope       = this;
        let cfConfig    = this._data.crossfilterData["explainer"];
        const attribute = "objective:hyperparameter";

        // Determine color scheme, color domain.
        const colorScheme = [
            // '#ca0020','#f4a582','#f7f7f7','#92c5de','#0571b0'
            // '#ca0020','#f4a582','#ffffff','#92c5de','#0571b0'
            '#a50f15', '#de2d26', '#fb6a4a', '#fcae91', '#fee5d9',
            "#ffffff", '#bdd7e7', '#6baed6', '#3182bd', '#08519c'
        ];
        // let colorDomain = ModelDetailPanel._calculateColorDomain(cfConfig.extrema["weight"], colorScheme);
        let colorDomain = ModelDetailPanel._calculateColorDomain({min: -1, max: 1}, colorScheme);

        const explainerPane = $("#model-details-explainer-pane");
        this._charts["explainerHeatmap"]
            .height(explainerPane.height() + 10)
            .width(explainerPane.width())
            .dimension(cfConfig.dimensions[attribute])
            .group(cfConfig.groups[attribute])
            .colorAccessor(d => d.value)
            .colors(
                d3.scale
                    .linear()
                    .domain(colorDomain)
                    .range(colorScheme)
            )
            .keyAccessor(d => d.key[0])
            .valueAccessor(d => d.key[1])
            .cellSizeModifier(d => Math.abs(d.value))
            .title(d => scope._explanationRuleLookup[d.key[1]][d.key[0]])
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

    _reconstructTable()
    {
        // Remove old table, if exists.
        $('div.model-detail-table').remove();

        // Construct new table - easier than updating existing one.
        this._charts["table"] = new ModelDetailTable(
            "ModelDetailTable",
            this,
            this._data._dataset_for_table_cols,
            this._data,
            null,
            this._divStructure.recordPane.tableID
        );
    }

    _redrawRecordScatterplots()
    {
        // Fetch divs containing attribute sparklines.
        let chartContainerDiv   = $("#" + this._divStructure.scatterplotPaneID);

        // -------------------------------------------------------
        // 1. Reset existing chart container.
        // -------------------------------------------------------

        // Reset chart container.
        chartContainerDiv.empty();
        // Reset flag for colorcoding selector.
        this._colorcodingSPOptionsAreSet = false;

        // -------------------------------------------------------
        // 2. Append new chart containers, draw scatterplots.
        // -------------------------------------------------------

        this._charts["scatterplots"]    = {};
        const numDimensions             = this._data._allModelMetadata[this._data._modelID].n_components;
        let numPlotsInRow               = Math.max(numDimensions - 1, 1);
        const scatterplotWidth          = chartContainerDiv.width() / numPlotsInRow - 10;
        const scatterplotHeight         = chartContainerDiv.height() / numPlotsInRow + 3;

        // Generate all combinations of dimension indices.
        for (let i = 0; i < Math.max(numDimensions - 1, 1); i++) {
            let chartRowDiv = Utils.spawnChildDiv(
                this._divStructure.scatterplotPaneID,
                "model-detail-scatterplot-row-" + i,
                "model-detail-scatterplot-row"
            );
            $("#" + chartRowDiv.id).css('height', (scatterplotHeight + 5) + 'px');

            // Consider that we want to draw a scatterplot with the added "fake"/zero axis if we have a dataset with a
            // one-dim. embedding.
            for (let j = Math.max(numDimensions, 2) - 1; j >= i + 1; j--) {
                // Generate scatterplot.
                let scatterplot = this._generateScatterplot(
                    [i, j],
                    {
                        height: scatterplotHeight,
                        width: scatterplotWidth
                    },
                    chartRowDiv.id,
                    Math.max(numDimensions, 2)
                );

                // Render chart.
                scatterplot.render();
                this._charts.scatterplots[i + ":" + j] = scatterplot;
                this._lastHighlightedPositions[i + ":" + j] = null;
            }
        }

        // Add colorcoding control.
        Utils.spawnChildDiv(
            this._divStructure.scatterplotPaneID, "scatterplot-colorcoding-box", null,
            "<img src='./static/img/icon-color.png' id='colorcoding-SP-icon' alt='Pick color encoding for scatterplots.' width='20px'>Color by" +
            "<select class='colorcoding-select' id='" + this._colorcodingSPSelectID + "'>" +
            "  <option value='none'>None</option>" +
            "</select>"
        );
        // Add event listener for color coding: Update scatterplot color when used.
        $("#" + this._colorcodingSPSelectID).change(() => {
            // Update colorization methods.
            this._updateScatterplotColorScheme(this._optionValues);
        });

        // Update colorcoding selection values.
        this.scatterplotColorCodingSelectValues = this._data.numericalAttributes;
    }

    /**
     * Sets values for colorCoding in record scatterplots.
     * @param values Array of values to show.
     */
    set scatterplotColorCodingSelectValues(values)
    {
        if (!this._colorcodingSPOptionsAreSet) {
            let select = $("#" + this._colorcodingSPSelectID);

            for (let value of values.sort((a, b) => a.localeCompare(b))) {
                select.append($("<option />").val(value).text(value));
            }
            this._colorcodingSPOptionsAreSet = true;
        }
    }

    /**
     * Redraws co-ranking matrix from scratch.
     * @private
     */
    _redrawCorankingmatrix()
    {
        // -------------------------------------------------------
        // 1. Reset existing chart container.
        // -------------------------------------------------------

        let chartContainerDiv = $("#coranking-matrix");
        chartContainerDiv.empty();

        // -------------------------------------------------------
        // 2. Append new chart containers, draw co-ranking matrix.
        // -------------------------------------------------------

        const nBins = 10;
        this._charts["corankingMatrix"]  = new CorankingMatrix(
            "Co-ranking matrix",
            this,
            ["high_dim_neighbour_bin", "low_dim_neighbour_bin"],
            this._operator._dataset._corankingMatrixData,
            this._operator._dataset.getCurrentlyFilteredPairwiseDisplacmentRecordIDs(
                this._filteredRecordIDs
            ),
            {},
            "coranking-matrix",
            this._operator._target,
            this._operator._dataset._crossfilterData.low_dim_projection.dimensions.idCorankingMatrix,
            this._operator._dataset._allModelMetadata[0].num_records,
            nBins
        );
    }

    /**
     * Redraws Shepard diagram from scratch.
     * @private
     */
    _redrawShepardDiagram()
    {
        // -------------------------------------------------------
        // 1. Reset existing chart container.
        // -------------------------------------------------------

        let chartContainerDiv = $("#shepard-diagram");
        chartContainerDiv.empty();

        // -------------------------------------------------------
        // 2. Append new chart containers, draw Shepard diagram.
        // -------------------------------------------------------

        this._charts["shepardDiagram"]  = new HexagonalHeatmap(
            "Shepard diagram",
            this,
            ["high_dim_distance", "low_dim_distance"],
            this._operator._dataset._pairwiseDisplacementData,
            this._operator._dataset.getCurrentlyFilteredPairwiseDisplacmentRecordIDs(
                this._filteredRecordIDs
            ),
            {},
            "shepard-diagram",
            this._operator._target,
            this._operator._dataset._crossfilterData.low_dim_projection.dimensions.idShepardDiagram
        );
    }

    /**
     * Generates scatterplot (including divs).
     * @param currIndices Array of length 2 holding current indices (i, j). Used to generate keys for access to
     * crossfilter dimensions and groups and to generate unique div IDs.
     * @param scatterplotSize Size of scatterplot. Has .height and .width.
     * @param parentDivID
     * @param nDimensionsToDraw Number of dimensions to draw. Used to adjust axis labeling.
     * @returns {dc.scatterPlot} Generated scatter plt.
     * @private
     */
    _generateScatterplot(currIndices, scatterplotSize, parentDivID, nDimensionsToDraw)
    {
        const numDimensions     = this._data._allModelMetadata[this._data._modelID].n_components;
        let cf_config           = this._data.crossfilterData["low_dim_projection"];
        const i                 = currIndices[0];
        const j                 = currIndices[1];
        const key               = i + ":" + j;
        const dataPadding       = {
            x: cf_config.intervals[i] * 0.1,
            y: numDimensions > 1 ? cf_config.intervals[j] * 0.1 : 0.1
        };

        let scatterplotContainer = Utils.spawnChildDiv(
            parentDivID,
            "model-detail-scatterplot-" + i + "-" + j,
            "model-detail-scatterplot"
        );
        $("#" + scatterplotContainer.id).css('left', (i * (scatterplotSize.width + 10)) + 'px');

        // Configure scatterplot.
        let scatterplot = dc.scatterPlot("#" + scatterplotContainer.id, this._operator._target);
        scatterplot
            .height(scatterplotSize.height)
            .width(scatterplotSize.width)
            .x(d3.scale.linear().domain([
                cf_config.extrema[i].min - dataPadding.x,
                cf_config.extrema[i].max + dataPadding.x
            ]))
            .y(d3.scale.linear().domain([
                cf_config.extrema[j].min - dataPadding.y,
                cf_config.extrema[j].max + dataPadding.y
            ]))
            .renderHorizontalGridLines(true)
            .renderVerticalGridLines(true)
            .dimension(cf_config.dimensions[key])
            .group(cf_config.groups[key])
            .keyAccessor(d => d.key[0])
            .valueAccessor(d => d.key[1])
            .existenceAccessor(d => d.value.count > 0)
            .excludedSize(3)
            .title(d => d.value.items.map(record => record["record_name"]).join(";"))
            .excludedOpacity(0.7)
            .excludedColor("#ccc")
            .symbolSize(4)
            .filterOnBrushEnd(true)
            .mouseZoomable(false)
            .transitionDuration(0)
            .margins({top: 0, right: 0, bottom: 30, left: 18});

        // Set axis labels for outermost scatterplots.
        const axisLabelToPlot = j === i + 1;
        scatterplot.yAxisLabel(axisLabelToPlot ? "Dimension " + (i + 1) : "");
        scatterplot.xAxisLabel(axisLabelToPlot ? "Dimension " + (j + 1) : "");

        // Workaround: Move brush selection behind first chart layer so we can have both brush selection and a popup on
        // hover. Source:
        // https://stackoverflow.com/questions/57922917/mouseover-or-onclick-event-not-working-on-scatterplot-in-dc-js.
        scatterplot.on("renderlet.chart", function(chart) {
            chart.g().node().insertBefore(chart.select('g.brush').node(), chart.select('g.chart-body').node());
        });

        // Set color methods.
        // scatterplot.colorAccessor(this._scatterplotColorizingMethods.colorAccessor);
        // scatterplot.colors(this._scatterplotColorizingMethods.colors);

        scatterplot.render();
        scatterplot.yAxis().ticks(5);
        scatterplot.xAxis().ticks(5);
        scatterplot.yAxis().tickFormat(function(v) { return ""; });
        scatterplot.xAxis().tickFormat(function(v) { return ""; });

        return scatterplot;
    }

    /**
     * Draws sparklines for attributes (i. e. hyperparameters and objectives).
     * @param updateValues
     * @private
     */
    _redrawAttributeSparklines(updateValues = true)
    {
        let dataset             = this._data;
        let drMetaDataset       = dataset._drMetaDataset;
        // Fetch metadata structure (i. e. attribute names and types).
        let metadataStructure   = drMetaDataset._metadata;

        // Fetch divs containing attribute sparklines.
        let contentDivs = {
            hyperparameters: $("#" + this._divStructure.attributePane.hyperparameterContentID),
            objectives: $("#" + this._divStructure.attributePane.objectiveContentID)
        };

        // Reset sparkline container div.
        contentDivs.hyperparameters.html("");
        contentDivs.objectives.html("");

        // -------------------------------------------------------
        // 1. Gather/transform data.
        // -------------------------------------------------------

        // Gather values for bins from DRMetaDataset instance.
        if (updateValues || this._sparklineValues === false)
            this._sparklineValues = this._data.preprocessDataForSparklines();

        // -------------------------------------------------------
        // 2. Draw charts.
        // -------------------------------------------------------

        // Generate table for attribute charts.
        let chartDivIDs = {};
        for (const valueType in this._sparklineValues) {
            let attributeTable = "" +
                "<table style='width:100%' class='attributeTable'>" +
                "<tr>" +
                    "<th>Name</th>" +
                    "<th>Value</th>" +
                    "<th>Histogram</th>" +
                "</tr>";

            for (const attribute of metadataStructure[valueType]) {
                const key           = valueType === "hyperparameters" ? attribute.name : attribute;
                const value         = dataset._allModelMetadata[dataset._modelID][key];
                chartDivIDs[key]    = Utils.uuidv4();

                attributeTable += "<tr>";
                attributeTable +=   "<td>" + DRMetaDataset.translateAttributeNames()[key] + "</td>";
                attributeTable +=   "<td>" + (isNaN(value) ? value : Math.round(value * 1000) / 1000) + "</td>";
                attributeTable +=   "<td id='" + chartDivIDs[key] + "'></td>";
                attributeTable += "</tr>";
            }

            contentDivs[valueType].html(attributeTable + "</table>");
        }


        // Draw hyperparameter charts.
        for (const valueType in this._sparklineValues) {
            for (const attribute of metadataStructure[valueType]) {
                let key             = valueType === "hyperparameters" ? attribute.name : attribute;
                let record          = this._sparklineValues[valueType][key];

                // Append new div for attribute.
                let chartContainerDiv = Utils.spawnChildDiv(
                    chartDivIDs[key], null, "model-detail-sparkline-container"
                );

                // Draw chart.
                const chartContainer = $("#" + chartContainerDiv.id);
                chartContainer.sparkline(
                    record.data,
                    {
                        type: "bar",
                        barWidth: Math.min(Math.max(10, chartContainer.width() / (record.data.length * 1.25)), 30),
                        barSpacing: 1,
                        chartRangeMin: 0,
                        height: 20,
                        tooltipFormat: '{{offset:offset}}',
                        tooltipValueLookups: {'offset': record.tooltips},
                        colorMap: record.colors
                    }
                );
            }
        }

    }

    processSettingsChange(optionValues)
    {
        $("html").css("cursor", "wait");
        this._filteredRecordIDs = this._data.currentlyFilteredIDs;

        // Attribute to color-code scatterplots changed - update color scale for all scatterplots.
        if (
            optionValues.scatterplotColorCoding !== this._optionValues.scatterplotColorCoding ||
            optionValues.scatterplotColorCodingUseLog !== this._optionValues.scatterplotColorCodingUseLog
        )
            this._updateScatterplotColorScheme(optionValues);

        // Remember last option state.
        this._optionValues = optionValues;
        $("html").css("cursor", "default");
    }

    /**
     * Updates color schemes for all scatterplots.
     * @param optionValues
     * @param render
     * @private
     */
    _updateScatterplotColorScheme(optionValues, render = true)
    {
        let instance            = this;
        const defaultFillColor  = "#1f77b4";
        const attr              = $("#" + this._colorcodingSPSelectID).val();

        if (attr !== "none") {
            const extrema   = this._data._cf_extrema[attr];
            const logBuffer = 0.000001 - Math.min(extrema.min, 0);

            // Create color schemes.
            const colors = attr !== "none" ? d3
                .scaleLinear()
                .domain([
                    optionValues.scatterplotColorCodingUseLog ? Math.log(extrema.min + logBuffer) : extrema.min,
                    optionValues.scatterplotColorCodingUseLog ? Math.log(extrema.max + logBuffer) : extrema.max
                ])
                .range(["#fff7fb", "#1f77b4"]) : null;

            this._scatterplotColorizingMethods = {
                colorAccessor: d => d.value.items.reduce(
                    (sum, record) => sum + parseFloat(record[attr]), 0
                ) / d.value.items.length,
                colors: d => optionValues.scatterplotColorCodingUseLog ? colors(Math.log(d + logBuffer)) : colors(d)
            };
        }

        else {
            this._scatterplotColorizingMethods = {
                colorAccessor: d => d,
                colors: d => defaultFillColor
            };
        }

        // Set new colorization methods, render.
        for (let scatterplotID in this._charts.scatterplots) {
            let scatterplot = this._charts.scatterplots[scatterplotID];
            scatterplot.colorAccessor(instance._scatterplotColorizingMethods.colorAccessor);
            scatterplot.colors(instance._scatterplotColorizingMethods.colors);

            if (render)
                scatterplot.render();
        }
    }

    /**
     * Updates dataset; re-renders charts with new data.
     */
    update()
    {
        let scope       = this;
        this._data      = this._operator._dataset;
        let data        = this._data;

        // Get initial data points.
        this._filteredRecordIDs = this._data.currentlyFilteredIDs;

        // Update explainer rule lookup.
        this._updateExplanationRuleLookup();

        // Update header.
        $("#" + this._divStructure.infoDivID).html(this._generateInfoDivContent());
        $("#model-detail-title").text("Embedding Details for Embedding #" + data._modelID);

        // Initialize star rating.
        $("span.embedding-rating").starRating({
            starSize: 20,
            disableAfterRate: false,
            hoverColor: "gold",
            ratedColor: "gold",
            activeColor: "gold",
            useFullStars: true,
            initialRating: data._drMetaDataset.getDataByID(data._modelID).rating,
            callback: (currentRating, $el) => {
                // Update rating.
                data._drMetaDataset.updateRating(data._modelID, currentRating, scope._name);
                // Switch back to global view.
                scope.operator.stage._detailSplitPane.collapse(1);
            }
        });

        // Set click listener.
        this._settingsPanel.setClickListener("model-detail-settings-icon");

        // Update data availability indicator.
        this._hasLoaded = true;

        // Render charts.
        this.render();
    }

    _updateTableHeight()
    {
        let tablePanelDiv = $("#model-details-block-record-table");
        $("div.model-detail-table .dataTables_scrollBody").css(
            'height', (tablePanelDiv.height() - 100) + "px"
        );
    }

    resize()
    {
        if (!this._hasLoaded)
            return;

        // Check modal.
        const panelDiv = $("#" + this._target);

        // Panel size has been changed - redraw everything.
        if (panelDiv.width() !== this._lastPanelSize.width || panelDiv.height() !== this._lastPanelSize.height) {
            this._lastPanelSize = {width: panelDiv.width(), height: panelDiv.height()};

            this._redrawAttributeSparklines(false);
            this._redrawAttributeInfluenceHeatmap();
            this._redrawRecordScatterplots();
            this._redrawShepardDiagram();
            this._updateTableHeight();
        }

        // Split positions have been changed.
        else {
            // Check splits.
            for (const pos in this._splits) {
                const new_sizes = this._splits[pos].getSizes();

                if (new_sizes[0] !== this._lastSplitPositions[pos][0] || new_sizes[1] !== this._lastSplitPositions[pos][1]) {
                    this._lastSplitPositions[pos] = new_sizes;

                    switch (pos) {
                        case "all":
                            this._redrawAttributeSparklines(false);
                            this._redrawAttributeInfluenceHeatmap();
                            this._redrawRecordScatterplots();
                            this._redrawShepardDiagram();
                            this._redrawCorankingmatrix();
                            break;
                        case "left":
                            this._redrawAttributeInfluenceHeatmap();
                            break;
                        case "middle":
                            this._redrawRecordScatterplots();
                            this._updateTableHeight();
                            break;
                        case "right":
                            this._redrawShepardDiagram();
                            this._redrawCorankingmatrix();
                            break;
                        default:
                            break;
                    }
                }
            }
        }
    }

    /**
     * Visually highlights record with given ID in scatterplot.
     * @param scatterplotID
     * @param scatterplot
     * @param idToHighlight
     */
    _highlightRecordInScatterplot(scatterplotID, scatterplot, idToHighlight)
    {
        let instance    = this;
        let chart       = scatterplot;
        const id        = idToHighlight;

        chart.selectAll('path.symbol').each(function(record) {
            if (record.value.items.find(record => record.id === id) !== undefined) {
                const lastHighlightedPos = instance._lastHighlightedPositions[scatterplotID];
                record.coordinates = {
                    x: chart.x()(chart.keyAccessor()(record)),
                    y: chart.y()(chart.valueAccessor()(record))
                };

                let circles = chart.chartBodyG()
                    .selectAll("circle")
                    .data([record])
                    .enter()
                    .append("circle")
                    .attr("class", "highlight")
                    .attr("opacity", 1)
                    .attr("r", 5)
                    .attr("cx", d => lastHighlightedPos !== null ? lastHighlightedPos.x : d.coordinates.x)
                    .attr("cy", d => lastHighlightedPos !== null ? lastHighlightedPos.y : d.coordinates.y)
                    .style("fill", "red");

                dc
                    .transition(circles, 100, chart.transitionDelay())
                    .attr("cx", d => d.coordinates.x)
                    .attr("cy", d => d.coordinates.y);

                instance._lastHighlightedPositions[scatterplotID] = record.coordinates;
            }
        });
    }

    highlight(id, source, propagate = false)
    {
        // We know that the only possible source we want to consider for a highlighting operation is the correponding
        // ModelDetailTable instance, so we can safely ignore all other sources.
        if (this._charts["table"] !== null) {
            if (this._charts["table"].name === source) {
                for (const scatterplotID in this._charts["scatterplots"]) {
                    let chart = this._charts["scatterplots"][scatterplotID];

                    if (id !== null)
                        this._highlightRecordInScatterplot(scatterplotID, chart, id);

                    else
                        // Re-rendering the chart clears all added (highlight) circles.
                        // Selecting and deleting highlighted circles is cheaper - potential optimization target, if
                        // deemed necessary.
                        chart.render();
                }

            }
        }
    }

     /**
      * Updates filter in scatterplots after selection in other charts (histograms, Shepard diagram, coranking matrix).
      * @param source
      * @param recordIDs Set of recordIDs.
      */
    updateFilteredRecordBuffer(source, recordIDs)
    {
        this._filteredRecordIDs = recordIDs;

        // Update CF state.
        if (source === this._charts.shepardDiagram._name)
            this._charts.table._cf_chart.redraw();

        // Scatterplots never use updateFilteredRecordBuffer, so we can unconditionally update them.
        for (let scatterplotID in this._charts.scatterplots) {
            this._charts.scatterplots[scatterplotID].render();
        }
    }

    refreshChartsAfterTableFiltering()
    {
        for (let chartID in this._charts["scatterplots"])
            this._charts["scatterplots"][chartID].render();

        this._charts["shepardDiagram"].redraw();
        this._charts["corankingMatrix"].redraw();
    }
}