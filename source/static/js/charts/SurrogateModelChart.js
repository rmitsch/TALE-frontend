import Chart from "./Chart.js";
import Utils from "../Utils.js"


/**
 * Creates chart for surrogate model.
 * Supported so far: Decision tree.
 * Code for tree: https://bl.ocks.org/ajschumacher/65eda1df2b0dd2cf616f.
 * Alternative: http://bl.ocks.org/pprett/3813537.
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
            rulesTable: ["rule", "precision", "recall", "support", "interval_start", "interval_end"]
        };
        this._divStructure = this._createDivStructure();

        // Construct graph.
        this.constructCFChart();
    }

    /**
     * Construction happens at rendering time.
     */
    constructCFChart()
    {
        this._constructRulesTable();
    }

    /**
     * Construct rules table.
     * @private
     */
    _constructRulesTable()
    {
        const tableID = this._divStructure.tableID;

        this._charts.rulesTable = $("#" + tableID).DataTable({
            scrollX: true,
            scrollY: Math.floor($("#" + this._panel._target).height()) + "px",
            fixedColumns: false
        });

        let instance    = this;
        const table     = $("#" + tableID + " tbody");
        const stage     = instance._panel._operator._stage;
        // stage.addKeyEventListener(this, SurrogateModelChart.processKeyEvent);

        // On hover: Highlight data point on hover in scatterplots & histograms.
        table.on('mouseenter', 'tr', function () {
            if (instance._charts.rulesTable.row(this).data() !== null)
                console.log("mouseenter");
            }
        );
        // Clear highlighting on mouseout.
        table.on('mouseout', 'tr', function () {
            console.log("mouseout");
        });

        // On (double-)click: Open detail view.
        table.on('dblclick', 'td', function (e) {
            // Instruct model detail operator to load data for the selected model.
            console.log("dblclick");
        });

        // On click: Filter.
        table.on('click', 'td', function (e) {
            const row           = instance._charts.rulesTable.row(this);
            const selectedID    = row.data()[0];

            console.log("click");
        });
    }

    /**
     * Resets canvas and updates dataset.
     * @param dataset
     */
    reset(dataset)
    {
        this._dataset = dataset;
    }

    /**
     * Constructs and draws chart drawing decision tree.
     * Source: https://bl.ocks.org/ajschumacher/65eda1df2b0dd2cf616f.
     */
    render()
    {
        this._charts.rulesTable.draw();
        this._charts.rulesTable.columns.adjust();
        this._charts.rulesTable.fixedColumns().relayout();
    }

    resize()
    {
        console.log("resize");
        let operatorDiv = $("#" + this._panel._operator._target);

        // Check if panel height has changed.
        if (
            operatorDiv.height() !== this._lastPanelSize.height ||
            operatorDiv.width() !== this._lastPanelSize.width
        ) {
            console.log("rendering")

            this.render();
        }
    }

    _createDivStructure()
    {
        let chartDiv = Utils.spawnChildDiv(this._target, null, "surrogate-model-chart");
        let tableDiv = Utils.spawnChildDiv(this._target, null, "surrogate-model-table-container");

        // Create table.
        let table       = document.createElement('table');
        table.id        = Utils.uuidv4();
        table.className = "display";
        $("#" + tableDiv.id).append(table);

        // Create table header.
        let tableHeader = "<thead><tr><th>ID</th>";
        // Append all hyperparameter to table.
        for (let i = 0; i < this._attributes.rulesTable.length; i++) {
            tableHeader += "<th>" + this._attributes.rulesTable[i] + "</th>";
        }
        tableHeader += "</tr></thead>";
        $("#" + table.id).append(tableHeader);

        return {
            chartDivID: chartDiv.id,
            tableContainerDivID: tableDiv.id,
            tableID: table.id
        };
    }
}