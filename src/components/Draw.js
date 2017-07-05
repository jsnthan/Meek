/**
 * Created by zypc on 2016/11/15.
 */

import Component from './Component'

import {Style} from '../style/Style'

import FeaureLayer from '../lyr/FeatureLayer'
import Feature from '../meek/Feature'
import Geometry from '../geometry/Geometry'
import Point from '../geometry/Point'
import Line from '../geometry/Line'
import Polygon from '../geometry/Polygon'
import Extent from '../geometry/Extent'
import {ExtentUtil} from '../geometry/support/ExtentUtil'
import {listen, unlistenByKey} from '../core/EventManager'
import {EventType} from '../meek/EventType'
import BrowserEvent from '../meek/BrowserEvent'

import DrawEvent from './DrawEvent'

/**
 * Draw class is resonsibility to draw geometries.
 *
 * 图形绘制工具，可以绘制点、线、面等图形
 *
 * @class Draw
 * @extends Component
 * @module component
 * @constructor
 * @example
 *
 *      // 实例化绘图工具
 *      var drawTool = new Datatang.Draw({
 *        type: 'point',
 *        drawLayer: new Datatang.FeatureLayer()
 *      })
 *
 */
export default class Draw extends Component {
  
  /**
   *
   * @param options
   */
  constructor (options = {}) {
    super()
  
    this.applyHandleEventOption({
      handleDownEvent: this._handleDownEvent,
      handleMouseEvent: this.handleMouseEvent,
      handleUpEvent: this._handleUpEvent
    })
    
    /**
     *
     * @type {null}
     * @private
     */
    this._mapRenderKey = null
    
    /**
     * 绘制作用图层
     * 需要给绘制工具一个绘制的图层
     * @type {null}
     * @private
     */
    this._drawLayer = options.drawLayer ? options.drawLayer : null
  
    /**
     * Keep the point while mouse pressing down
     * @type {null}
     * @private
     */
    this._downPointPx = null
  
    /**
     * Finish coordinate for the feature ( first point for polygons, last point for line)
     * @type {null}
     * @private
     */
    this._finishCoordinate = null
  
    /**
     * Drawing mode (derivied from geometry type.)
     * @type {*}
     */
    this.drawMode = Draw.getDrawMode(options.type)
  
    /**
     * Sketch coordinates. Used when drawing a line or polygon.
     * @type
     * @private
     */
    this._sketchCoords = null
  
    /**
     * Sketch line. Used when drawing polygon.
     * @private
     */
    this._sketchLine = null
  
    /**
     * A function to decide if a potential finish coordinate is permissable
     * @private
     * @type
     */
    this._finishCondition = options.finishCondition ?
        options.finishCondition : function () { return true }
        
    /**
     *
     * @type {Function}
     * @private
     */
    this._undoCondition = options.undoCondition ?
        options.undoCondition : function () { return true }
        
    // add keyboard events
    if (options.undoCondition || options.finishCondition) {
      listen(document, 'keyup',
        this._handleKeyboardEvent, this)
    }
  
    /**
     * 初始化草稿图层，用于临时显示绘制的图形
     *
     * @type {FeatureLayer}
     * @private
     */
    this._sketchLayer = new FeaureLayer({name: 'sketch layer for draw component'})
    this._sketchLayer.style = this.getDefaultStyleFunction()
  
    /**
     * Sketch point.
     * @type {null}
     * @private
     */
    this._sketchPoint = null
  
    /**
     * Sketch feature drawed on temp layer
     * @type {null}
     * @private
     */
    this._sketchFeature = null
  
    /**
     * The function that can build a geometry by the passed geometry type.
     * @type {null}
     * @private
     */
    this._geometryFunction = null
  
    /**
     * Sketch line coordinates. Used when drawing a polygon or circle.
     * @private
     */
    this._sketchLineCoords = null
  
    /**
     * @type {boolean}
     * @private
     */
    this._freehand = false
  
    /**
     * Pixel distance for snapping.
     * @type {number}
     * @private
     */
    this._snapTolerance = options.snapTolerance ?
        options.snapTolerance : 12
  
    /**
     * The number of points that can be drawn before a polygon ring or line string
     * is finished. The default is no restriction.
     * @type {number}
     * @private
     */
    this._maxPoints = options.maxPoints ?
        options.maxPoints : Infinity
  
    /**
     * The number of points that must be drawn before a polygon ring or line
     * string can be finished.  The default is 3 for polygon rings and 2 for
     * line strings.
     * @type {number}
     * @private
     */
    this._minPoints = options.minPoints ?
      options.minPoints :
      (this.drawMode === Draw.DrawMode.POLYGON ? 3 : 2)
  
    /**
     * @private
     * @type
     */
    this._freehandCondition = options.freehandCondition ?
      options.freehandCondition : function () { return true }
      
  }
  
  /**
   * Handler the keyboard event
   * @param event
   * @private
   */
  _handleKeyboardEvent (event) {
    
    // If finish drawing
    if (this._finishCondition(event)) {
      if (this.drawMode === Draw.DrawMode.POLYGON) {
        const pcoordinates = this._sketchFeature.geometry.getCoordinates()
        if (pcoordinates.length < 5) {
          return
        }
      }
      
      this._finishDrawing()
    }
    
    // If undo drawing
    if (this._undoCondition(event)) {
      this._undoDrawing()
    }
  }
  
  /**
   * Get the geometry function.
   *
   * 获取图形创建、修改的工厂方法
   *
   * @property geometryFunction
   * @type {Function}
   */
  get geometryFunction () {
    if(!this._geometryFunction){
      this._geometryFunction = this._initGeometryFunction()
    }
    
    return this._geometryFunction
  }
  
  /**
   * The draw mode getter and setter.
   * Set a draw mode means to draw a new type geometry.
   *
   * 设置当前绘图的模式，重新赋值将会启动新图形类型的绘制
   *
   * @property drawMode
   * @type {Datatang.Draw.DrawMode}
   */
  get drawMode () { return this._drawMode }
  set drawMode (value){
    this._drawMode = value
    
    this._sketchLineCoords = null
    this._abortDrawing()
  
    this._minPoints = this._drawMode === Draw.DrawMode.POLYGON ? 3 : 2
  }
  
  /**
   * 图形生产工厂方法
   * @returns {*} 返回一个geometry对象
   * @private
   */
  _geometryFactory () {
    let Constructor
    let mode = this.drawMode
  
    if (mode === Draw.DrawMode.POINT) {
      Constructor = Point
    } else if (mode === Draw.DrawMode.LINE) {
      Constructor = Line
    } else if(mode === Draw.DrawMode.POLYGON) {
      Constructor = Polygon
    } else if (mode === Draw.DrawMode.EXTENT) {
      Constructor = Extent
    }
    
    return Constructor
  }
  
  /**
   * 设置缺省 geometryfunction
   * @returns {function(*, *)}
   * @private
   */
  _initGeometryFunction () {
    const geometryFunction = (coordinates, opt_geometry) => {
      let mode = this.drawMode
      let geometry = opt_geometry
      
      if (geometry) {
        if (mode === Draw.DrawMode.POLYGON) {
          geometry.setCoordinates(coordinates[0].concat([coordinates[0][0]]))
        } else if(mode === Draw.DrawMode.LINE) {
          geometry.setCoordinates(coordinates)
        } else if(mode === Draw.DrawMode.EXTENT) {
          geometry.setCoordinates(ExtentUtil.boundingExtent(coordinates))
        }
      } else {
        let Constructor = this._geometryFactory()
        geometry = new Constructor(coordinates[0],coordinates[1])
      }
      
      return geometry
    }
    
    return geometryFunction
  }
  
  /**
   *
   * @param event
   * @returns {*|boolean}
   */
  handleMouseEvent (event) {
    this.freehand_ = false
    let pass = !this.freehand_
    const eventType = event.type
    
    event.coordinate = this.coordinateBeyond(event.coordinate)
    
    if (this.freehand_ &&
      eventType === BrowserEvent.MOUSE_DRAG && this._sketchFeature !== null) {
      this._addToDrawing(event)
      pass = false
    } else
      
    if (eventType === BrowserEvent.MOUSE_MOVE) {
      pass = this._handleMove(event)
    } else if (eventType === BrowserEvent.DBLCLICK) {
      pass = false
    }
    
    return super.handleMouseEvent(event) && pass
  }
  
  /**
   * Handle move events
   * @param {BrowserEvent} event A move event.
   * @return {boolean} Pass the event to other compoments.
   * @private
   */
  _handleMove (event) {
    if (this._finishCoordinate) {
      this._modifyDrawing(event)
    } else {
      this._updateSketchPoint(event)
    }
    
    return true
  }
  
  /**
   * Handle down events
   * @param {BrowserEvent} event A up event.
   * @returns {boolean}
   * @private
   */
  _handleDownEvent (event) {
    this._downPointPx = event.pixel
    return true
  }
  
  /**
   * Handle up events.
   * @param {BrowserEvent} event
   * @private
   */
  _handleUpEvent (event) {
    const downPx = this._downPointPx
    const clickPx = event.pixel, mode = this.drawMode
    
    const dx = downPx[0] - clickPx[0]
    const dy = downPx[1] - clickPx[1]
    const clickDistance = dx * dx + dy * dy
    
    if (clickDistance <= 36) {
      if (!this._finishCoordinate) {
        this._startDrawing(event)
  
        // 点绘制在up的时候结束
        if (this.drawMode === Draw.DrawMode.POINT) {
          this._finishDrawing()
        }
      } else if (mode === Draw.DrawMode.CIRCLE ) {
        //
        //
      } else if (mode === Draw.DrawMode.EXTENT) {
        this._finishDrawing()
      }
      else if (this._atFinish(event)) {
        if (this._finishCondition(event)) {
          this._finishDrawing()
        }
      } else {
        this._addToDrawing(event)
      }
    }
  }
  
  /**
   * 启动绘制，生成feature
   * Start the drawing
   * @param {BrowserEvent} event
   * @private
   */
  _startDrawing (event) {
    const startPoint = event.coordinate
    this._finishCoordinate = startPoint
    
    const _drawMode = this.drawMode
    
    // 构造geometry数据
    if (_drawMode === Draw.DrawMode.POINT) {
      this._sketchCoords = startPoint.slice() // 缓存up的点
    } else if (_drawMode === Draw.DrawMode.POLYGON ) {
      this._sketchCoords = [[startPoint.slice(), startPoint.slice()]]
      this._sketchLineCoords = this._sketchCoords[0]// temp line
    } else {
      this._sketchCoords = [startPoint.slice(),startPoint.slice()] // 缓存up的点，最后一个值，用于move的替换
      
      if (_drawMode === Draw.DrawMode.EXTENT) {
        this._sketchLineCoords = this._sketchCoords
      }
    }
  
    if (this._sketchLineCoords) {
      this._sketchLine = new Feature(new Line(this._sketchLineCoords))
    }
    
    // Build a geometry uesed sketchCorrdds
    const geometry = this.geometryFunction(this._sketchCoords)
    
    this._sketchFeature = new Feature()
    
    this._sketchFeature.geometry = geometry
    
    // Redraw the sketch features
    this._updateSketchFeatures()
    
    // 派发绘制开始事件
    // Trigger the draw-strat event
    this.dispatchEvent(new DrawEvent(DrawEvent.EventType.DRAW_START, this._sketchFeature))
  }
  
  /**
   * Modify the drawing
   * @param event
   * @private
   */
  _modifyDrawing (event) {
    let coordinate = event.coordinate
    const geometry = this._sketchFeature.geometry
    let coordinates = null, last = null
    const mode = this.drawMode
    
    if (mode === Draw.DrawMode.POINT) {
      last = this._sketchCoords
    } else if (mode === Draw.DrawMode.POLYGON) {
      coordinates = this._sketchCoords[0]
      last = coordinates[coordinates.length - 1]
      if (this._atFinish(event)) {
        coordinate = this._finishCoordinate.slice()
      }
    } else {
      coordinates = this._sketchCoords // 获取up的点
      last = coordinates[coordinates.length - 1]// 替换为当前MOve的点，形成一条path
    }
    
    last[0] = coordinate[0]
    last[1] = coordinate[1]
    
    // 给 geometry 赋值
    this.geometryFunction(this._sketchCoords, geometry)
    
    // 更新点坐标
    if (this._sketchPoint) {
      const sketchPointGeom = this._sketchPoint.geometry
      sketchPointGeom.update(coordinate[0],coordinate[1])
    }
    
    let sketchLineGeom
    if (mode === Draw.DrawMode.EXTENT) {
      if (!this._sketchLine) {
        this._sketchLine = new Feature(new Line(null))
      }
      
      const rings = geometry.getCoordinates()
      sketchLineGeom = this._sketchLine.geometry
      sketchLineGeom.path = rings
    } else if (this._sketchLineCoords) {
      sketchLineGeom =  (this._sketchLine.geometry)
      sketchLineGeom.path = this._sketchLineCoords
    }
    
    this._updateSketchFeatures()
  }
  
  /**
   * Stop drawing and add the sketch feature to the target layer.
   * @private
   */
  _finishDrawing () {
    if (this._sketchFeature === null){
      return
    }

    const sketchFeature = this._abortDrawing()// 中止绘制，
    const coordinates = this._sketchCoords
    const geometry = (sketchFeature.geometry)
  
    if (this.drawMode === Draw.DrawMode.LINE) {
      // remove the redundant last point
      coordinates.pop()
      this.geometryFunction(coordinates, geometry)
    } else if (this.drawMode === Draw.DrawMode.POLYGON) {
      // When we finish drawing a polygon on the last point,
      // the last coordinate is duplicated as for LineString
      // we force the replacement by the first point
      coordinates[0].pop()
      coordinates[0].push(coordinates[0][0])
      this.geometryFunction(coordinates, geometry)
    }
  
    // First dispatch event to allow full set up of feature
    this.dispatchEvent(new DrawEvent(DrawEvent.EventType.DRAW_END, sketchFeature))
  
    // Then insert feature
    // if (this._features) {
    //   this.features_.push(sketchFeature)
    // }
  
    // 最终放到shource中，形成正式feature
    if (this._drawLayer) {
      // let newFeature = new Feature(geometry)
      this._drawLayer.addFeatures([sketchFeature])
    }
  }
  
  /**
   * Stop drawing without adding the sketch feature to the sketch layer
   * @returns {Feature|null|_Feature2.default}
   * @private
   */
  _abortDrawing () {
    this._finishCoordinate = null
    const sketchFeature = this._sketchFeature
    if (sketchFeature) {
      this._sketchFeature = null
      this._sketchPoint = null
      this._sketchLine = null
      this._sketchLayer.clear()
    }
    
    return sketchFeature
  }
  
  /**
   * Add a new coordinate to the drawing
   * @param event
   * @private
   */
  _addToDrawing (event) {
    const coordinate = event.coordinate
    const geometry = this._sketchFeature.geometry
    let coordinates,done
    const mode = this.drawMode
    
    if (mode === Draw.DrawMode.LINE) {
      this._finishCoordinate = coordinate.slice()
      coordinates = this._sketchCoords
      coordinates.push(coordinate.slice())
      done = coordinates.length > this._maxPoints
      
      this.geometryFunction(coordinates, geometry)
    } else if (mode === Draw.DrawMode.POLYGON) {
      coordinates = this._sketchCoords[0]
      coordinates.push(coordinate.slice())
      done = coordinates.length > this._maxPoints
      
      if (done) {
        this._finishCoordinate = coordinates[0]
      }
      
      this.geometryFunction(this._sketchCoords, geometry)
    }
    
    this._updateSketchFeatures()
    
    if (done) {
      this._finishDrawing()
    }
  }
  
  /**
   * Determine if an event is within the snapping tolerance of the start coord.
   * @param event
   * @returns {boolean}
   * @private
   */
  _atFinish (event) {
    let at = false
    if (this._sketchFeature) {
      let potentiallyDone = false
      let potentiallyFinishCoordinates = [this._finishCoordinate]
      
      if (this.drawMode === Draw.DrawMode.LINE) {
        potentiallyDone = this._sketchCoords.length > this._minPoints
      } else if (this.drawMode === Draw.DrawMode.POLYGON) {
        potentiallyDone = this._sketchCoords[0].length > this._minPoints
        potentiallyFinishCoordinates = [this._sketchCoords[0][0],
          this._sketchCoords[0][this._sketchCoords[0].length - 2]]
      }
      
      if (potentiallyDone) {
        const map = event.map
        for (let  i = 0, ii = potentiallyFinishCoordinates.length; i < ii; i++) {
          const finishCoordinate = potentiallyFinishCoordinates[i]
          const finishPixel = map.getPixelFromCoordinate(finishCoordinate)
          const pixel = event.pixel
          const dx = pixel[0] - finishPixel[0]
          const dy = pixel[1] - finishPixel[1]
          const freehand = this._freehand && this._freehandCondition(event)
          const snapTolerance = freehand ? 1 : this._snapTolerance
          at = Math.sqrt(dx * dx + dy * dy) <= snapTolerance
          if (at) {
            this._finishCoordinate = finishCoordinate
            break
          }
        }
      }
    }
    return at
  }
  
  /**
   * Create or update the sketch point
   * @param event
   * @private
   */
  _updateSketchPoint (event) {
    let coordinates = event.coordinate
  
    if (this._sketchPoint === null) {
      const geom = new Point(coordinates[0], coordinates[1])
      this._sketchPoint = new Feature(geom)
      this._updateSketchFeatures()
    } else {
      const sketchPointgeom = this._sketchPoint.geometry
      sketchPointgeom.setCoordinates(coordinates)
      // this.changed()
    }
  }
  
  /**
   * Redraw the sketch featrues.
   * @private
   */
  _updateSketchFeatures () {
    const features = []

    if (this._sketchFeature){
      features.push(this._sketchFeature)
    }
    
    if (this._sketchLine) {
      features.push(this._sketchLine)
    }
    
    if (this._sketchPoint) {
      features.push(this._sketchPoint)
    }
    
    // 出发map的render
    this._sketchLayer.clear()
    this._sketchLayer.addFeatures(features)
  }
  
  /**
   * Undo the drawing
   * @private
   */
  _undoDrawing () {
    const drawMode = this.drawMode
    if (drawMode === Draw.DrawMode.LINE ) {
      if (this._sketchFeature) {
        const coordinates = this._sketchFeature.geometry.getCoordinates()
        if (coordinates.length > 2) {
          
          coordinates.splice(coordinates.length - 2, 1)
          this._sketchFeature.changed()
        }
      }
    } else if (drawMode === Draw.DrawMode.POLYGON) {
      if (this._sketchFeature) {
        
        const pcoordinates = this._sketchFeature.geometry.getCoordinates()
        
        if (pcoordinates.length > 3 ) {
          pcoordinates.splice(pcoordinates.length - 3, 1)
  
          const lineCoordinate = this._sketchLine.geometry.getCoordinates()
          lineCoordinate.splice(lineCoordinate.length - 2, 1)
          this._sketchFeature.changed()
        }
      }
    }
  }
  
  /**
   * Map setter.
   * It will add an event listener of map rendering.
   * @property map {Datatang.map} mapVal
   */
  set map (mapValue) {
    if (this._mapRenderKey) {
      unlistenByKey(this._mapRenderKey)
      this._mapRenderKey = null
    }

    if (mapValue) {
      this._map = mapValue
      // this._mapRenderKey = listen(this, EventType.CHANGE, mapValue.render, mapValue)
    }
    
    this._updateState()
  }
  
  get map (){ return this._map }
  
  /**
   * Update the drawing state for aborting drawing if active is false
   * @private
   */
  _updateState () {
    const map = this.map
    const active = this.active
    if (!map || !active){
      this._abortDrawing()
    }
  
    this._sketchLayer.map = active ? map : null
  }
  
  /**
   * Get the default style which will be used while a feature is drawn
   * @returns {Function}
   */
  getDefaultStyleFunction () {
    const styles = Style.createDefaultEditing()
    return function (feature) {
      return styles[feature.geometry.geometryType]
    }
  }
  
  /**
   *
   * @returns {boolean}
   */
  shouldStopEvent () {
    return false
  }
  
  get drawLayer () { return this._drawLayer }
  
}

/**
 * The static fucntion is responsibility to get the current draw mode
 * @param type
 * @returns {*}
 */
Draw.getDrawMode = function(type) {
  let drawMode = null
  
  switch (type){
  case Geometry.POINT:
  case Geometry.MULTI_POINT:
    drawMode = Draw.DrawMode.POINT
    break
  case Geometry.LINE:
  case Geometry.MULTI_LINE:
    drawMode = Draw.DrawMode.LINE
    break
  case Geometry.POLYGON:
  case Geometry.MULTI_POLYGON:
    drawMode = Draw.DrawMode.POLYGON
    break
  case Geometry.EXTENT:
    drawMode = Draw.DrawMode.EXTENT
    break
  }
  
  return drawMode
}


/**
 * Draw mode.  This collapses multi-part geometry types with their single-part
 * cousins.
 * @enum {string}
 */
Draw.DrawMode = {
  POINT: 'Point',
  LINE: 'Line',
  POLYGON: 'Polygon',
  CIRCLE: 'Circle',
  EXTENT: 'Extent'
}