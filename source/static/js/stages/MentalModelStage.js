import Stage from './Stage.js'

/**
 * Stage for exploration.
 */
export default class MentalModelStage extends Stage
{
    /**
     *
     * @param name
     * @param target ID of container div.
     * @param datasets Dictionary of isnstance of dataset class.
     */
    constructor(name, target, datasets)
    {
        super(name, target, datasets);

        // Store splitter instance for bottom div.
        this._bottomSplitPane   = null;

        // Construct operators.
        this.constructOperators();
    }


    /**
     * Construct all panels for this view.
     */
    constructOperators()
    {
    }

    filter(source, embeddingIDs)
    {
    }

    get shiftDown()
    {
        return this._shiftDown;
    }

    get ctrlDown()
    {
        return this._ctrlDown;
    }

    get keyEventCallbacks()
    {
        return this._keyEventCallbacks;
    }
}