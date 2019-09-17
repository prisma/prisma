import fetch from 'node-fetch'
import { useState, useEffect } from 'react'

const resultCache: { [key: string]: any } = {}

export function useFetch(url: string, transform?: (data: any) => any) {
  const [state, setState] = useState(null as any)

  useEffect(() => {
    if (resultCache[url]) {
      setState(resultCache[url])
    } else {
      fetch(url)
        .then(res => res.json())
        .then(res => {
          const result = transform ? transform(res) : res
          resultCache[url] = result
          setState(result)
        })
    }
  }, [url])

  return state
}
