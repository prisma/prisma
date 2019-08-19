import React from 'react'
import { Box } from 'ink'
import { drawBox } from './drawBox'

interface Layout {
  bottom: number
  height: number
  left: number
  right: number
  top: number
  width: number
}

export default class BorderBox extends React.Component<any> {
  ref: any
  state = {
    border: '',
    height: 0,
    width: 0,
  }
  setRef = ref => {
    this.ref = ref
    const layout: Layout = this.ref.nodeRef.current.yogaNode.getComputedLayout()
    const width = this.props.width || layout.width
    const height = this.props.height || layout.height

    const border = drawBox({
      title: this.props.title,
      width: width + 0,
      height,
      str: '',
      drawExtension: this.props.extension,
    })
    this.setState({ border, height, width })
  }
  render() {
    const { props } = this
    const { marginTop, marginBottom, marginLeft, marginRight, paddingBottom, paddingTop, ...rest } = props
    const extensionTop = this.props.extension ? -1 : 0
    const outerProps = {
      marginTop: (marginTop || 0) + extensionTop,
      marginBottom,
      marginLeft,
      marginRight,
    }
    return (
      <Box flexDirection="column" {...outerProps}>
        <Box>{this.state.border}</Box>
        <Box
          ref={this.setRef}
          marginTop={-this.state.height}
          marginLeft={2}
          paddingTop={paddingTop}
          paddingBottom={(paddingBottom || 0) + 2}
          {...rest}
        />
      </Box>
    )
  }
}
