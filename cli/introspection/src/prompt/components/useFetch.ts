import fetch from 'node-fetch'
import { useState, useEffect } from 'react'

const resultCache: { [key: string]: any } = {}

export function useFetch(url: string) {
  const [state, setState] = useState(null as any)

  useEffect(() => {
    if (resultCache[url]) {
      setState(resultCache[url])
    } else {
      fetch(url)
        .then(res => res.json())
        .then(res => {
          resultCache[url] = res
          setState(res)
        })
    }
  }, [url])

  return state
}
