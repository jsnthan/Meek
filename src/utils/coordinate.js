/**
 * Created by zypc on 2017/6/4.
 */
export const Coordinate = {}

Coordinate.add = function(coordinate, delta) {
  coordinate[0] += delta[0]
  coordinate[1] += delta[1]
  return coordinate
}


Coordinate.rotate = function(coordinate, angle) {
  const cosAngle = Math.cos(angle)
  const sinAngle = Math.sin(angle)
  const x = coordinate[0] * cosAngle - coordinate[1] * sinAngle
  const y = coordinate[1] * cosAngle + coordinate[0] * sinAngle
  coordinate[0] = x
  coordinate[1] = y
  return coordinate
}

Coordinate.scale = function(coordinate, scale) {
  coordinate[0] *= scale
  coordinate[1] *= scale
  return coordinate
}


export default {
  Coordinate
}