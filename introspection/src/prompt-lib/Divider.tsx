import { Box, Color } from 'ink'
import * as React from 'react'
import stringWidth from 'string-width'

interface Props {
  title?: string | null
  width?: number
  padding?: number
  titlePadding?: number
  titleColor?: string
  dividerChar?: string
  dividerColor?: string
}

// Helpers
const getSideDividerWidth = (width: number, titleWidth: number) => (width - titleWidth) / 2
const getNumberOfCharsPerWidth = (char: string, width: number) => width / stringWidth(char)

const PAD = ' '

export const Divider: React.SFC<Props> = ({
  title,
  width,
  padding,
  titlePadding,
  titleColor,
  dividerChar,
  dividerColor,
}) => {
  const titleString = title ? `${PAD.repeat(titlePadding!) + title + PAD.repeat(titlePadding!)}` : ''
  const titleWidth = stringWidth(titleString)

  const dividerWidth = getSideDividerWidth(width!, titleWidth)
  const numberOfCharsPerSide = getNumberOfCharsPerWidth(dividerChar!, dividerWidth)
  const dividerSideString = dividerChar!.repeat(numberOfCharsPerSide)

  const paddingString = PAD.repeat(padding!)

  return (
    <Box>
      {paddingString}
      <Color dim>{dividerSideString}</Color>
      <Color keyword={titleColor}>{titleString}</Color>
      <Color dim>{dividerSideString}</Color>
      {paddingString}
    </Box>
  )
}

Divider.defaultProps = {
  dividerChar: '─',
  dividerColor: 'dim',
  padding: 0,
  title: null,
  titleColor: 'white',
  titlePadding: 1,
  width: 50,
}
