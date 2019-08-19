import Chart from "./Chart.js";
import Utils from "../Utils.js"
import NumericalHistogram from "./NumericalHistogram.js";
import SurrogateModelDataset from "../data/SurrogateModelDataset.js";


/**
 * Creates chart for surrogate model.
 * Note: Should be renamed into SurrogateModelTable. Potentially could be refactored into class implementing
 * jquery's DataTable with scented histograms as scented widgets.
 */
export default class SurrogateModelChart extends Chart
{
    /**
     *
     * @param name
     * @param panel
     * @param attributes Ignored.
     * @param dataset
     * @param style
     * @param parentDivID
     */
    constructor(name, panel, attributes, dataset, style, parentDivID)
    {
        super(name, panel, attributes, dataset, style, parentDivID);

        this._charts = {};
        this._attributes = {
            rulesTable: ["rule", "precision", "recall", "support", "from", "to"]
        };
        this._rowsWithoutHistograms         = new Set(["ID", "rule"]);
        this._preScrollHistogramPositions    = {};
        this._divStructure                  = this._createDivStructure();
        this._tableScrollPosition           = 0;

        // Construct table; fill it.
        this.constructCFChart();
        this._initTableData();

        // Integrate table with crossfilter group.
        this._registerChartInDC();
    }

    /**
     * Construction happens at rendering time.
     */
    constructCFChart()
    {
        this._constructRulesTable();
    }

    _initTableData()
    {
        let records             = this._dataset._cf_dimensions.id.top(Infinity);
        let transformedRecords  = [records.length];

        // Transform records to format accepted by DataTable.
        for (let i = 0; i < records.length; i++) {
            let transformedRecord   = [this._attributes.rulesTable.length + 1];
            transformedRecord[0]    = records[i].id;
            for (let j = 0; j < this._attributes.rulesTable.length; j++) {
                transformedRecord[j + 1] = records[i][this._attributes.rulesTable[j]];
            }
            transformedRecords[i] = transformedRecord;
        }

        this._charts.rulesTable.rows.add(transformedRecords);
        this._charts.rulesTable.draw();
    }

    /**
     * Construct rules table.
     * @private
     */
    _constructRulesTable()
    {
        let instance    = this;
        const tableID   = this._divStructure.tableID;

        this._charts.rulesTable = $("#" + tableID).DataTable({
            scrollX: true,
            scrollY: Math.floor($("#" + this._panel._target).height()) + "px",
            fixedColumns: false
        });

        $(".surrogate-model-table-container .dataTables_scrollBody").on("scroll", function(event) {
            instance._tableScrollPosition = this.scrollLeft;
            instance.updateHistogramPositionsAfterScroll(this.scrollLeft);
        });

        const table     = $("#" + tableID + " tbody");
        const stage     = instance._panel._operator._stage;
        // stage.addKeyEventListener(this, SurrogateModelChart.processKeyEvent);

        // On hover: Highlight data point on hover in scatterplots & histograms.
        table.on('mouseenter', 'tr', function () {
            // if (instance._charts.rulesTable.row(this).data() !== null)
                // console.log("mouseenter");
            }
        );
        // Clear highlighting on mouseout.
        table.on('mouseout', 'tr', function () {
            // console.log("mouseout");
        });

        // On (double-)click: Open detail view.
        table.on('dblclick', 'td', function (e) {
            // Instruct model detail operator to load data for the selected model.
            // console.log("dblclick");
        });

        // On click: Filter.
        table.on('click', 'td', function (e) {
            const row           = instance._charts.rulesTable.row(this);
            const selectedID    = row.data()[0];

            // console.log("click");
        });

        // -------------------------------------
        // Add divs for column histograms.
        // -------------------------------------

        for (let i = 0; i < this._attributes.rulesTable.length; i++) {
            const columnTitle = this._attributes.rulesTable[i];
            if (!this._rowsWithoutHistograms.has(columnTitle)) {
                // Generate div.
                let divStructure = instance._divStructure;
                divStructure.histogramChartsDivIDs[columnTitle] = Utils.spawnChildDiv(
                    "surrogate-model-histogram-container",
                    "surrogate-model-table-histogram-" + columnTitle,
                    "surrogate-model-table-histogram"
                ).id;

                // Generate chart in div.
                instance._generateHistogram(columnTitle);
            }
        }
    }

    _generateHistogram(columnTitle)
    {
        this._charts[columnTitle + "Histogram"] = new NumericalHistogram(
            columnTitle + ".histogram",
            this._panel,
            [columnTitle],
            this._dataset,
            {
                showAxisLabels: false,
                // Use current container dimensions as size for chart.
                height: 40,
                width: 50,
                paddingFactor: 0.15,
                excludedColor: "#ccc",
                numberOfTicks: {x: "minmax", y: "minmax"},
                showTickMarks: true
            },
            // Place chart in previously generated container div.
            this._divStructure.histogramChartsDivIDs[columnTitle]
        );

        // Adjustments for histograms that diverge from default behaviour in NumericalHistogram class.
        this._charts[columnTitle + "Histogram"]._cf_chart
            .on("filtered", event => {})
            .margins({top: 5, right: 10, bottom: 16, left: 25})
    }

    /**
     * Resets canvas and updates dataset.
     * @param dataset
     */
    reset(dataset)
    {
        this._dataset = dataset;

        // Clear table and histograms, ingest new data.
        this._clearChartsAndTable();
        this._initTableData();
        for (let columnTitle in this._divStructure.histogramChartsDivIDs) {
            this._generateHistogram(columnTitle);
            this._charts[columnTitle + "Histogram"].render();
        }
    }

    /**
     * Constructs and draws chart drawing decision tree.
     * Source: https://bl.ocks.org/ajschumacher/65eda1df2b0dd2cf616f.
     */
    render()
    {
        this._charts.rulesTable.draw();
        let panelDiv = $("#" + this._target);

        // Update sizes.
        $("#" + this._target + " .dataTables_scrollBody").css(
            'height', Math.floor(panelDiv.height() - 317) + "px"
        );
        this.synchHistogramsWidthColumnHeaders();
        this.updateHistogramPositionsAfterScroll(this._tableScrollPosition);
    }

    resize()
    {
        let panelDiv = $("#" + this._target);

        // Update table height.
        if (panelDiv.height() !== this._lastPanelSize.height) {
            $("#" + this._target + " .dataTables_scrollBody").css(
                'height', Math.floor(panelDiv.height() - 317) + "px"
            );
        }

        // Update histogram size and positioning.
        if (panelDiv.width() !== this._lastPanelSize.width) {
            this.synchHistogramsWidthColumnHeaders();
        }

        // Store size of panel at time of last render.
        this._lastPanelSize.width = panelDiv.width();
        this._lastPanelSize.height = panelDiv.height();
    }

    /**
     * Fits histograms to column widths and positions.
     */
    synchHistogramsWidthColumnHeaders()
    {
        let currX = 75;

        $("#surrogate-model-histogram-container").width($("#" + this._divStructure.tableContainerDivID).width());

        for (let i = 0; i < this._attributes.rulesTable.length; i++) {
            const columnTitle   = this._attributes.rulesTable[i];
            const colWidth      = $("#surrogate-model-table-header-" + columnTitle).width() + 36;

            if (!this._rowsWithoutHistograms.has(columnTitle)) {
                let histogramDiv = $("#surrogate-model-table-histogram-" + columnTitle);

                histogramDiv.width(colWidth);
                histogramDiv.css({left: currX});

                this._preScrollHistogramPositions[columnTitle] = currX;
                this._charts[columnTitle + "Histogram"].updateWidth(colWidth, 5);
                this._charts[columnTitle + "Histogram"].render();
            }

            currX += colWidth;
        }
    }

    /**
     * Update histogram positions after scrolling table.
     * @param scrollLeft
     */
    updateHistogramPositionsAfterScroll(scrollLeft)
    {
        if (!isNaN(scrollLeft) && scrollLeft !== 0) {
            for (let i = 0; i < this._attributes.rulesTable.length; i++) {
                const columnTitle   = this._attributes.rulesTable[i];

                if (!this._rowsWithoutHistograms.has(columnTitle)) {
                    let histogramDiv = $("#surrogate-model-table-histogram-" + columnTitle);
                    histogramDiv.css({left: this._preScrollHistogramPositions[columnTitle] - scrollLeft});
                }
            }
        }
    }

    _createDivStructure()
    {
        let chartDiv = Utils.spawnChildDiv(this._target, null, "surrogate-model-chart");

        // -------------------------------------
        // Create histogram div.
        // -------------------------------------

        let histogramDiv = Utils.spawnChildDiv(this._target, "surrogate-model-histogram-container");

        // -------------------------------------
        // Create table.
        // -------------------------------------

        let tableDiv    = Utils.spawnChildDiv(this._target, null, "surrogate-model-table-container");
        let table       = document.createElement('table');
        table.id        = Utils.uuidv4();
        table.className = "display";
        $("#" + tableDiv.id).append(table);

        // Create table header.
        let tableHeader             = "<thead><tr><th>ID</th>";
        // Append all hyperparameter to table.
        for (let i = 0; i < this._attributes.rulesTable.length; i++) {
            const columnTitle = this._attributes.rulesTable[i];
            tableHeader += "<th id='surrogate-model-table-header-" + columnTitle + "'>" + columnTitle + "</th>";
        }
        tableHeader += "</tr></thead>";
        $("#" + table.id).append(tableHeader);

        return {
            chartDivID: chartDiv.id,
            tableContainerDivID: tableDiv.id,
            tableID: table.id,
            histogramDivID: histogramDiv.id,
            histogramChartsDivIDs: {}
        };
    }

    /**
     * Clears all charts and table.
     * @private
     */
    _clearChartsAndTable()
    {
        this._charts.rulesTable.clear();
        this._charts.rulesTable.redraw();

        for (let columnTitle in this._divStructure.histogramChartsDivIDs) {
            $("#" + this._divStructure.histogramChartsDivIDs[columnTitle]).empty();
        }
    }

    /**
     * Implement methods necessary for dc.js hook and integrate it into it's chart registry.
     */
    _registerChartInDC()
    {
        // --------------------------------
        // 1. Implement necessary elements
        // of dc.js' interface for charts.
        // --------------------------------

        let instance = this;

        this._charts.rulesTable.render = function() {
            // Redraw chart.
            instance._charts.rulesTable.draw();
        };

        this._charts.rulesTable.redraw = function() {
            // Update filtered IDs.
            let records = instance._dataset.cf_dimensions.id.top(Infinity);
            instance._filteredIDs = new Set();
            for (let i = 0; i < records.length; i++) {
                instance._filteredIDs.add(records[i].id)
            }

            // Filter table data using an ugly hack 'cause DataTable.js can't do obvious things.
            // Add filter only if it doesn't exist yet.
            if (!this._filterHasBeenSet)
                $.fn.dataTableExt.afnFiltering.push(
                    // oSettings holds information that can be used to differ between different tables -
                    // might be necessary once several tables use different filters.
                    function (oSettings, aData, iDataIndex) {
                        // Check oSettings to see if we have to apply this filter. Otherwise ignore (i. e. return true
                        // for all elements).
                        return oSettings.sTableId === instance._divStructure.tableID ?
                            instance._filteredIDs.has(+aData[0]) :
                            true;
                    }
                );

            // Redraw chart.
            instance._charts.rulesTable.draw();
        };

        this._charts.rulesTable.filterAll    = function() {
            // Reset brush.
            instance._charts.rulesTable.draw();
        };

        // --------------------------------
        // 2. Register table in dc.js'
        // registry.
        // --------------------------------

        // Use operators ID as group ID (all panels in operator use the same dataset and therefore should be notified if
        // filter conditions change).
        dc.chartRegistry.register(this._charts.rulesTable, this._panel._operator._target);
    }
}