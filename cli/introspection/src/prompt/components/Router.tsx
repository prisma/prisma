import React, { useContext, useEffect, useState } from 'react'
import { tabIndexContextState } from '@prisma/ink-components'

class RouterContextClass {
  private routes: { [key: string]: (active: boolean) => void } = {}
  private activeRoute?: string
  private stack: string[] = []
  registerRoute(route: string, cb: (active: boolean) => void) {
    this.routes[route] = cb
    if (this.activeRoute && this.activeRoute === route) {
      this.routes[route](true)
    }
  }
  unregisterRoute(route: string) {
    delete this.routes[route]
  }
  setRoute(route: string, replace?: boolean) {
    if (route !== this.activeRoute && this.routes[route]) {
      if (this.activeRoute && this.routes[this.activeRoute]) {
        this.routes[this.activeRoute](false)
      }
      if (this.routes[route]) {
        if (!replace) {
          if (this.stack[this.stack.length - 1] !== route) {
            this.stack.push(route)
          }
        }
        this.activeRoute = route
        tabIndexContextState.setActiveIndex(0)
        this.routes[route](true)
      }
    }
  }
  back(steps: number = 1) {
    if (this.stack.length > steps) {
      for (let i = 0; i < steps; i++) {
        this.stack.pop()
      }
      this.setRoute(this.stack[this.stack.length - 1], true)
    }
  }
  backTo(route: string) {
    const index = this.stack.lastIndexOf(route)
    if (index > -1) {
      this.stack = this.stack.slice(0, index + 1)
      this.setRoute(this.stack[this.stack.length - 1], true)
    }
  }
  setDefaultRoute(route: string) {
    if (!this.activeRoute) {
      this.setRoute(route)
    }
  }
}

const contextState = new RouterContextClass()

export const RouterContext = React.createContext(contextState)

export interface RouterProps {
  defaultRoute: string
}

export const Router: React.FC<RouterProps> = props => {
  const ctx = useContext(RouterContext)

  useEffect(() => {
    ctx.setDefaultRoute(props.defaultRoute)
  }, [props.defaultRoute])

  return <RouterContext.Provider value={contextState}>{props.children}</RouterContext.Provider>
}

export interface RouteProps {
  component: any
  path: string
}

export const Route: React.FC<RouteProps> = ({ component, path }) => {
  const ctx = useContext(RouterContext)
  const [active, setActive] = useState(false)

  useEffect(() => {
    const callback = active => {
      setActive(active)
    }
    ctx.registerRoute(path, callback)
    return () => {
      ctx.unregisterRoute(path)
    }
  }, [path])

  return active ? <>{component}</> : null
}
