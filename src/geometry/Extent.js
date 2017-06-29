/**
 * Created by zypc on 2016/11/13.
 */

import Geometry from './Geometry'
import {ExtentUtil} from './support/ExtentUtil'

/**
 * Extent geometry. <br/>
 *
 * 矩形类和数据结构
 *
 * @class Extent
 * @extends Geometry
 * @module geometry
 */
export default class Extent extends Geometry {

  /**
   * 构建一个extent对象
   * @param xmin
   * @param ymin
   * @param xmax
   * @param ymax
   */
  constructor (xmin = 0, ymin = 0, xmax = 0, ymax = 0) {
    super()

    this._xmin = xmin
    this._ymin = ymin
    this._xmax = xmax
    this._ymax = ymax
  
    this._rings = []
  }

  /**
   * 获取对象的几何类型
   * @abstrct function
   */
  get geometryType () { return Geometry.EXTENT }

  /**
   * 计算最小外接矩形(MBR)的中心点
   * @returns {*} 返回一个Point对象
   */
  get centerPoint () {
    // return new Point(this.centerX, this.centerY)
  }

  /**
   * 计算X坐标的中心
   * @property centerX
   * @returns {number}
   */
  get centerX () { return (this.xmax + this.xmin) / 2 }

  /**
   * 计算Y坐标的中心
   * @property centerY
   * @returns {number}
   */
  get centerY () { return (this.ymax + this.ymin) / 2 }

  /**
   * 计算最小外接矩形的宽
   * @property width
   * @returns {number}
   */
  get width () { return Math.abs(this.xmax - this.xmin) }

  /**
   * 计算最小外接矩形的高
   * @property height
   * @returns {number}
   */
  get heigth () { return Math.abs(this.ymax - this.ymin) }

  /**
   * 获取最小外接矩形
   * 本对象
   * @returns {MBR}
   */
  get extent () { return this }
  
  /**
   * @property xmin
   * @type Number
   */
  get xmin () { return this._xmin }
  set xmin (value) { this._xmin = value }
  
  /**
   * @property ymin
   * @type Number
   */
  get ymin () { return this._ymin }
  set ymin (value) { this._ymin = value }
  
  /**
   * @property xmax
   * @type Number
   */
  get xmax () { return this._xmax }
  set xmax (value) { this._xmax = value }
  
  /**
   * @property ymax
   * @type Number
   */
  get ymax () { return this._ymax }
  set ymax (value) { this._ymax = value }
  
  
  /**
   * Check if contains a point
   * @param x
   * @param y
   */
  containsXY (x, y) {
    return ExtentUtil.containsPoint(this, [x, y])
  }
  
  /**
   * @method getFlatInteriorPoint
   * @returns {[*,*]}
   */
  getFlatInteriorPoint () {
    return [this.centerX, this.centerY]
  }
  
  /**
   * Move the goemetry by the given x and y
   * @param x
   * @param y
   */
  move (x = 0, y = 0, opts) {
    const coordinate = this.getCoordinates()
  
    let beyond
    if (opts) {
      if (opts.beyond) {
        beyond = opts.beyond
      }
    }
    
    const width = this.width
    const height = this.heigth
    
    const minPoint = coordinate[0]
    const newMinPoint = new Array(2)
    
    newMinPoint[0] = minPoint[0] + x
    newMinPoint[1] = minPoint[1] + y
    
    if (beyond) {
      if (minPoint[0] < beyond.xmin) {
        minPoint[0] = beyond.xmin
        newMinPoint[0] = minPoint[0]
      }
      
      if (minPoint[0] + width + x >= beyond.xmax) {
        newMinPoint[0] = minPoint[0]
      }
  
      if (minPoint[1] < beyond.ymin) {
        minPoint[1] = beyond.ymin
        newMinPoint[1] = minPoint[1]
      }
  
      if (minPoint[1] + height + y >= beyond.ymax) {
        newMinPoint[1] = minPoint[1]
      }
    }
  
    const newCoordiante = [
      newMinPoint,
      [newMinPoint[0] + width, newMinPoint[1]],
      [newMinPoint[0] + width, newMinPoint[1] + height],
      [newMinPoint[0], newMinPoint[1] + height],
      newMinPoint]
    
    this.setCoordinates(newCoordiante)
  }
  
  /**
   * 设置多边形的边，如果设置了边，则需要重新计算
   * 外接矩形
   */
  get rings () {
    if (this._rings.length === 0) {
      if (this.xmin !== 0 && this.ymin !== 0 && this.xmax !== 0 && this.ymax !== 0) {
        this._rings = ExtentUtil.minMaxToRing(this.xmin, this.ymin, this.xmax, this.ymax)
      }
    }
    
    return this._rings
  }
  
  /**
   *
   * @param value
   */
  set rings (value) {
    this._rings = value
    let extentArr = ExtentUtil.boundingSimpleExtent(value)
    this.xmin = extentArr[0]
    this.ymin = extentArr[1]
    this.xmax = extentArr[2]
    this.ymax = extentArr[3]
  }
  
  /**
   * Get the collection of geometry
   * TODO 将来都需要换成这种线性的存储方式，并逐步替换成这种模式
   * @returns {[*,*]}
   */
  getCoordinates () {
    if (this._rings.length === 0) {
      if (this.xmin !== 0 && this.ymin !== 0 && this.xmax !== 0 && this.ymax !== 0) {
        this._rings = ExtentUtil.minMaxToRing(this.xmin, this.ymin, this.xmax, this.ymax)
      }
    }
  
    return this._rings
  }
  
  /**
   * @method setCoordinates
   * @param coordinates
   */
  setCoordinates (coordinates) {
    this.rings = coordinates
  
    let extentArr = ExtentUtil.boundingSimpleExtent(coordinates)
    this.xmin = extentArr[0]
    this.ymin = extentArr[1]
    this.xmax = extentArr[2]
    this.ymax = extentArr[3]
  }
  
  /**
   * Get index in this coordinates by given coordinate
   * @method getCoordinateIndex
   * @param coord
   * @returns {*|number}
   */
  getCoordinateIndex (coord) {
    return this.getCoordinates().findIndex(function(points){
      return points[0] === coord[0] && points[1] === coord[1]
    })
  }
  
  /**
   * Clone an extent
   * @returns {Extent}
   */
  clone () {
    return new Extent(this.xmin, this.ymin, this.xmax, this.ymax)
  }
  
}

