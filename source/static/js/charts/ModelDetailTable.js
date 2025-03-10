import Chart from "./Chart.js";
import Utils from "../Utils.js";
import NumericalHistogram from "./NumericalHistogram.js";

export default class ModelDetailTable extends Chart
{
    /**
     * ModelOverviewTable showing records with information on individual records in a dataset/embedding.
     * @param name
     * @param panel
     * @param attributes
     * @param dataset Instance of ModelDetailDataset, containing original dataset including all attributes + artifical
     * numerical ID (matching with ID used in embeddings).
     * @param style
     * @param parentDivID
     */
    constructor(name, panel, attributes, dataset, style, parentDivID)
    {
        // ----------------------------------------
        // 1. Initializing attributes.
        // ----------------------------------------

        super(name, panel, attributes, dataset, style, parentDivID);

        // Update involved CSS classes.
        $("#" + this._target).addClass("model-detail-table");

        // Initialize chart handler (too lazy to write a new class just for that).
        this._cf_chart  = {};
        this._charts    = {};

        // Create div structure.
        this._divStructure  = this._createDivStructure();
        this._tableID       = this._divStructure.tableID;

        // Stores table's pre-scroll histogram positions.
        this._preScrollHistogramPositions   = {};
        this._tableScrollPosition           = 0;

        // Select dimension of ID to use for later look-ups.
        this._dimension = this._dataset.crossfilterData["low_dim_projection"].dimensions["idTable"];

        // Store current search term.
        this._currentSearch     = "";
        // Create storage for filtered IDs.
        this._filteredIDsGlobal = null;
        this._filteredIDsLocal  = null;
        // Defines whether filter has already been added to jQuery's DataTable.
        this._filterHasBeenSet  = false;

        // ----------------------------------------
        // 2. Calling initialization procedures.
        // ----------------------------------------

        // Generate table.
        this._constructFCChart(this._tableID);

        // Implement methods necessary for dc.js hook and integrate it into it's chart registry.
        this._registerChartInDC();

        // Fill table initially.
        this._initTableData();

        // Synchronize histograms with columns.
        this.synchHistogramsWidthColumnHeaders();
        this.updateHistogramPositionsAfterScroll(this._tableScrollPosition);
    }

    /**
     * Fetches initial set of data for table.
     * Assumption: Data is not filtered at initialization.
     * @private
     */
    _initTableData()
    {
        this._cf_chart.rows.add(this._dataset.dataset_for_table);
        this._cf_chart.draw();
    }

    /**
     * Searches records with specified search term. Returns IDs of records in which search term was found.
     * @param searchTerm
     * @private
     * @return Set of IDs of records in which search term was found.
     */
    _searchRecords(searchTerm)
    {
        // Get data of all current rows in table.
        let filteredIDData = this._cf_chart.rows({filter : 'applied'}).data().map(row => row[0]);

        // Find numeric keys - these represent actual column data.
        const validFilteredIDKeys = new Set([...Array(filteredIDData.length).keys()]);

        // Extract IDs to filter.
        this._filteredIDsLocal = new Set(
            Object.entries(
                filteredIDData
            ).filter(
                entry => validFilteredIDKeys.has(parseInt(entry[0]))
            ).map(
                entry => entry[1]
            )
        )
    }

    /**
     * Constructs DataTable object.
     * @param tableID
     * @private
     */
    _constructFCChart(tableID)
    {
        let instance    = this;
        this._cf_chart  = $("#" + tableID).DataTable({
            scrollX: true,
            scrollY: Math.floor($("#model-details-block-record-table").height() - 235) + "px",
            fixedColumns: false,
            searching: true,
            "search": {
                "regex": true,
                "smart": false
            }
        });
        const table     = $("#" + tableID + " tbody");

        // Add eventl istener for updating histogram positions when table is scrolled.
        $(".model-detail-table-container .dataTables_scrollBody").on("scroll", function(event) {
            instance._tableScrollPosition = this.scrollLeft;
            instance.updateHistogramPositionsAfterScroll(this.scrollLeft);
        });

        // Highlight data point on hover in scatterplots & histograms.
        table.on('mouseenter', 'tr', function () {
            if (instance._cf_chart.row(this).data() !== null) {
                const idToHighlight = instance._cf_chart.row(this).data()[0];

                // Highlight histograms.
                for (let chartID in instance._charts)
                    instance._charts[chartID].highlight(idToHighlight, instance._name);

                // Highlights other charts in panel.
                instance._panel.highlight(idToHighlight, instance._name, false);
            }
        });
        // Clear highlighting on mouseout.
        table.on('mouseout', 'tr', function () {
            for (let chartID in instance._charts)
                instance._charts[chartID].highlight(null, instance._name);
            instance._panel.highlight(null, instance._name, false);
        });

        this._cf_chart.on('search.dt', (e, settings) => {
            this._currentSearch = this._cf_chart.search();

            if (this._currentSearch !== "") {
                // Get row data.
                let filteredIDData = this._cf_chart.rows({filter : 'applied'}).data().map(row => row[0]);
                // Find numeric keys - these represent actual column data.
                const validFilteredIDKeys = new Set([...Array(filteredIDData.length).keys()]);

                // Extract IDs to filter.
                this._filteredIDsLocal = new Set(
                    Object.entries(
                        filteredIDData
                    ).filter(
                        entry => validFilteredIDKeys.has(parseInt(entry[0]))
                    ).map(
                        entry => entry[1]
                    )
                )

                // Filter extracted row IDs.
                this._dimension.filter(id => this._filteredIDsLocal.has(id));
            }

            else
                this._dimension.filter(id => true);

            // Re-render histograms.
            for (const chartName in instance._charts)
                instance._charts[chartName].render();
            // Re-render other charts.
            this._panel.refreshChartsAfterTableFiltering();
        });

        // -------------------------------------
        // Add divs for column histograms.
        // -------------------------------------

        const attributeDataTypes = this._dataset._attributeDataTypes;
        for (let i = 0; i < this._attributes.length; i++) {
            const columnTitle = this._attributes[i];

            // Only numerical histograms supported for now.
            if (columnTitle !== "id" && attributeDataTypes[this._attributes[i]]["supertype"] !== "categorical") {
                // Generate div.
                let divStructure = instance._divStructure;
                divStructure.histogramChartsDivIDs[columnTitle] = Utils.spawnChildDiv(
                    "model-detail-histogram-container",
                    "model-detail-table-histogram-" + columnTitle.replace(/\s/g, '_'),
                    "model-detail-table-histogram"
                ).id;

                // Generate chart in div.
                this._charts[columnTitle + "Histogram"] = instance._generateHistogram(columnTitle);
            }
        }
    }

    _createDivStructure()
    {
        // Create histogram div.
        let histogramDiv = Utils.spawnChildDiv(this._target, "model-detail-histogram-container");

        // Create table.
        let tableDiv    = Utils.spawnChildDiv(this._target, null, "model-detail-table-container");
        let table       = document.createElement('table');
        table.id        = Utils.uuidv4();
        table.className = "display";
        $("#" + tableDiv.id).append(table);

        // Create table header.
        let tableHeader = "<thead><tr><th>ID</th>";
        // Append all hyperparameter to table.
        for (let i = 0; i < this._attributes.length; i++) {
            const attr = this._attributes[i];
            tableHeader += "<th id='model-detail-table-header-" + this._attributes[i].replace(/\s/g, '_') + "'>" + attr + "</th>";
        }
        tableHeader += "</tr></thead>";
        $("#" + table.id).append(tableHeader);

        return {
            tableID: table.id,
            histogramChartsDivIDs: {}
        };
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

        this._cf_chart.render       = function() {
            // Redraw chart.
            instance._cf_chart.draw();
        };

        this._cf_chart.redraw       = function() {
            // Update filtered IDs.
            instance._dimension.filter(id => true);
            instance._filteredIDsGlobal = new Set(instance._dimension.top(Infinity).map(record => record.id));

            // Filter table data using an ugly hack 'cause DataTable.js can't do obvious things.
            // Add filter only if it doesn't exist yet.
            if (!this._filterHasBeenSet)
                $.fn.dataTableExt.afnFiltering.push(
                    // oSettings holds information that can be used to differ between different tables -
                    // might be necessary once several tables use different filters.
                    function (oSettings, aData, iDataIndex) {
                        // Check oSettings to see if ew have to apply this filter. Otherwise ignore (i. e. return true
                        // for all elements).
                        return oSettings.sTableId === instance._tableID ?
                            instance._filteredIDsGlobal.has(+aData[0]) :
                            true;
                    }
                );

            // Redraw table & charts.
            instance._cf_chart.draw();
            for (const chartName in instance._charts)
                instance._charts[chartName].render();

            // instance._panel.refreshChartsAfterTableFiltering();
        };

        this._cf_chart.filterAll    = function() {
            // Reset brush.
            instance._cf_chart.draw();
        };

        // --------------------------------
        // 2. Register parcoords plot in
        // dc.js' registry.
        // --------------------------------

        // Use operators ID as group ID (all panels in operator use the same dataset and therefore should be notified if
        // filter conditions change).
        dc.chartRegistry.register(this._cf_chart, this._panel._operator._target);
    }

    highlight(id, source)
    {
        if (source !== this._target) {
        }
    }

    /**
     * Fits histograms to column widths and positions.
     */
    synchHistogramsWidthColumnHeaders()
    {
        const attributeDataTypes    = this._dataset._attributeDataTypes;
        let currX                   = 75;

        $("#model-detail-histogram-container").width($("#" + this._divStructure.tableContainerDivID).width());

        for (let i = 0; i < this._attributes.length; i++) {
            const columnTitle   = this._attributes[i];
            const colWidth      = $("#model-detail-table-header-" + columnTitle.replace(/\s/g, '_')).width() + 36;

            if (attributeDataTypes[this._attributes[i]]["supertype"] !== "categorical") {
                let histogramDiv = $("#model-detail-table-histogram-" + columnTitle.replace(/\s/g, '_'));

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
        const attributeDataTypes = this._dataset._attributeDataTypes;

        if (!isNaN(scrollLeft) && scrollLeft !== 0) {
            for (let i = 0; i < this._attributes.length; i++) {
                const columnTitle = this._attributes[i];

                if (attributeDataTypes[this._attributes[i]]["supertype"] !== "categorical") {
                    let histogramDiv = $("#model-detail-table-histogram-" + columnTitle.replace(/\s/g, '_'));
                    histogramDiv.css({left: this._preScrollHistogramPositions[columnTitle] - scrollLeft});
                }
            }
        }
    }

    /**
     * Generates attribute histogram for specified column.
     * @param columnTitle
     * @returns {NumericalHistogram}
     * @private
     */
   _generateHistogram(columnTitle)
   {
       let instance = this;

       let histogram = new NumericalHistogram(
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
       histogram._cf_chart
           .on("filtered", event => {
               instance._panel.updateFilteredRecordBuffer(instance._name, instance._dataset.currentlyFilteredIDs);
           })
           .transitionDuration(0)
           .margins({top: 5, right: 10, bottom: 16, left: 25})

       return histogram;
    }
}