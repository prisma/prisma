import React, { useContext, useEffect, useState } from 'react'
import { tabIndexContextState } from './TabIndex'

class RouterContextClass {
  private routes: { [key: string]: (active: boolean) => void } = {}
  private activeRoute?: string
  public lastRoute?: string
  registerRoute(route: string, cb: (active: boolean) => void) {
    this.routes[route] = cb
    if (this.activeRoute && this.activeRoute === route) {
      this.routes[route](true)
    }
  }
  unregisterRoute(route: string) {
    delete this.routes[route]
  }
  setRoute(route: string) {
    if (route !== this.activeRoute && this.routes[route]) {
      if (this.activeRoute && this.routes[this.activeRoute]) {
        this.routes[this.activeRoute](false)
      }
      this.lastRoute = this.activeRoute
      this.activeRoute = route
      if (this.routes[route]) {
        tabIndexContextState.setActiveIndex(0)
        this.routes[route](true)
      }
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
