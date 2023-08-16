package main

import (
	"context"
	"flag"
	"fmt"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/bufbuild/connect-go"
	gonanoid "github.com/matoous/go-nanoid/v2"
	"github.com/planetscale/psdb/auth"
	"golang.org/x/net/http2"
	"golang.org/x/net/http2/h2c"
	"vitess.io/vitess/go/mysql"
	"vitess.io/vitess/go/sqlescape"
	"vitess.io/vitess/go/sqltypes"
	"vitess.io/vitess/go/vt/vterrors"

	psdbv1alpha1 "github.com/mattrobenolt/ps-http-sim/types/psdb/v1alpha1"
	"github.com/mattrobenolt/ps-http-sim/types/psdb/v1alpha1/psdbv1alpha1connect"
)

var (
	connPool map[mysqlConnKey]*timedConn
	connMu   sync.RWMutex
)

type mysqlConnKey struct {
	username, pass, session string
}

type timedConn struct {
	*mysql.Conn
	lastUsed time.Time
}

var (
	commandLine = flag.NewFlagSet(os.Args[0], flag.ExitOnError)

	flagHTTPAddr         = commandLine.String("http-addr", "127.0.0.1", "HTTP server address")
	flagHTTPPort         = commandLine.Uint("http-port", 8080, "HTTP server port")
	flagMySQLAddr        = commandLine.String("mysql-addr", "127.0.0.1", "MySQL address")
	flagMySQLPort        = commandLine.Uint("mysql-port", 3306, "MySQL port")
	flagMySQLNoPass      = commandLine.Bool("mysql-no-pass", false, "Don't use password for MySQL connection")
	flagMySQLIdleTimeout = commandLine.Duration("mysql-idle-timeout", 10*time.Second, "MySQL connection idle timeout")
	flagMySQLMaxRows     = commandLine.Uint("mysql-max-rows", 1000, "Max rows for a single query result set")
	flagMySQLDbname      = commandLine.String("mysql-dbname", "mysql", "MySQL database to connect to")
)

// getConn gets or dials a connection from the connection pool
// connections are maintained unique for credential combos and session id
// since this isn't meant to truly represent reality, it's possible you
// can do things with connections locally by munging session ids or auth
// that aren't allowed on PlanetScale. This is meant to just mimic the public API.
func getConn(ctx context.Context, uname, pass, session string) (*mysql.Conn, error) {
	key := mysqlConnKey{uname, pass, session}

	// check first if there's already a connection
	connMu.RLock()
	if conn, ok := connPool[key]; ok {
		connMu.RUnlock()
		conn.lastUsed = time.Now()
		return conn.Conn, nil
	}
	connMu.RUnlock()

	// if not, dial for a new connection
	// without a lock, so parallel dials can happen
	rawConn, err := dial(ctx, uname, pass)
	if err != nil {
		return nil, err
	}

	// lock to write to map
	connMu.Lock()
	connPool[key] = &timedConn{rawConn, time.Now()}
	connMu.Unlock()

	// since it was parallel, the last one would have won and been written
	// so re-read back so we use the conn that was actually stored in the pool
	connMu.RLock()
	conn := connPool[key]
	connMu.RUnlock()
	return conn.Conn, nil
}

// dial connects to the underlying MySQL server, and switches to the underlying
// database automatically.
func dial(ctx context.Context, uname, pass string) (*mysql.Conn, error) {
	if *flagMySQLNoPass {
		pass = ""
	}
	conn, err := mysql.Connect(ctx, &mysql.ConnParams{
		Host:  *flagMySQLAddr,
		Port:  int(*flagMySQLPort),
		Uname: uname,
		Pass:  pass,
	})
	if err != nil {
		return nil, err
	}
	if _, err := conn.ExecuteFetch("USE "+sqlescape.EscapeID(*flagMySQLDbname), 1, false); err != nil {
		conn.Close()
		return nil, err
	}
	return conn, nil
}

func init() {
	// Vitess doesn't play nicely, so replace the entire default flagset
	flag.CommandLine = commandLine
	flag.Parse()
}

func main() {
	initConnPool()
	mux := http.NewServeMux()
	mux.Handle(psdbv1alpha1connect.NewDatabaseHandler(&server{}))
	panic(http.ListenAndServe(
		fmt.Sprintf("%s:%d", *flagHTTPAddr, *flagHTTPPort),
		h2c.NewHandler(mux, &http2.Server{}),
	))
}

type server struct{}

func (s *server) CreateSession(
	ctx context.Context,
	req *connect.Request[psdbv1alpha1.CreateSessionRequest],
) (*connect.Response[psdbv1alpha1.CreateSessionResponse], error) {
	creds, err := auth.ParseWithSecret(req.Header().Get("Authorization"))
	if err != nil || creds.Type() != auth.BasicAuthType {
		return nil, connect.NewError(connect.CodeUnauthenticated, err)
	}

	session := gonanoid.Must()

	if _, err := getConn(context.Background(), creds.Username(), string(creds.SecretBytes()), session); err != nil {
		if strings.Contains(err.Error(), "Access denied for user") {
			return nil, connect.NewError(connect.CodeUnauthenticated, err)
		}
		return nil, err
	}

	return connect.NewResponse(&psdbv1alpha1.CreateSessionResponse{
		Branch: gonanoid.Must(), // there is no branch, so fake it
		User: &psdbv1alpha1.User{
			Username: creds.Username(),
			Psid:     "planetscale-1",
		},
		Session: session,
	}), nil
}

func (s *server) Execute(
	ctx context.Context,
	req *connect.Request[psdbv1alpha1.ExecuteRequest],
) (*connect.Response[psdbv1alpha1.ExecuteResponse], error) {
	creds, err := auth.ParseWithSecret(req.Header().Get("Authorization"))
	if err != nil || creds.Type() != auth.BasicAuthType {
		return nil, connect.NewError(connect.CodeUnauthenticated, err)
	}

	msg := req.Msg
	query := msg.Query
	session := msg.Session

	// if there is no session, let's generate a new one
	if session == "" {
		session = gonanoid.Must()
	}

	conn, err := getConn(context.Background(), creds.Username(), string(creds.SecretBytes()), session)
	if err != nil {
		if strings.Contains(err.Error(), "Access denied for user") {
			return nil, connect.NewError(connect.CodeUnauthenticated, err)
		}
		return nil, err
	}

	// This is a gross simplificiation, but is likely sufficient
	qr, err := conn.ExecuteFetch(query, int(*flagMySQLMaxRows), true)
	return connect.NewResponse(&psdbv1alpha1.ExecuteResponse{
		Session: session,
		Result:  sqltypes.ResultToProto3(qr),
		Error:   vterrors.ToVTRPC(err),
	}), nil
}

func initConnPool() {
	connPool = make(map[mysqlConnKey]*timedConn)
	go func() {
		// clean up stale based on flagMySQLIdleTimeout
		// this is just very quick and simple, it has race conditions,
		// but I don't care for this.
		timer := time.NewTicker(*flagMySQLIdleTimeout)
		for {
			<-timer.C
			expiration := time.Now().Add(-*flagMySQLIdleTimeout)
			expired := make([]mysqlConnKey, 0)

			// find which connections are idle
			connMu.RLock()
			for key, conn := range connPool {
				if conn.lastUsed.Before(expiration) {
					expired = append(expired, key)
				}
			}
			connMu.RUnlock()

			if len(expired) > 0 {
				for _, key := range expired {
					connMu.RLock()
					conn, ok := connPool[key]
					connMu.RUnlock()

					if !ok {
						continue
					}

					connMu.Lock()
					conn.Close()
					delete(connPool, key)
					connMu.Unlock()
				}
			}
		}
	}()
}
