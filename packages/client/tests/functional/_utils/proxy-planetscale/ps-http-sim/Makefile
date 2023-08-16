gomod := github.com/mattrobenolt/ps-http-sim

PSDB_PROTO_OUT := types
PSDB_PROTO_ROOT := $(PSDB_PROTO_OUT)/psdb
PSDB_V1ALPHA1 := $(PSDB_PROTO_ROOT)/v1alpha1

PROTOC_VERSION=21.5

BIN := bin

UNAME_OS := $(shell uname -s)
UNAME_ARCH := $(shell uname -m)

proto: \
	$(PSDB_V1ALPHA1)/database.pb.go

clean: clean-proto clean-bin

clean-proto:
	rm -rf $(PSDB_PROTO_OUT)

clean-bin:
	rm -rf $(BIN)

$(BIN):
	mkdir -p $(BIN)

$(PSDB_PROTO_OUT):
	mkdir -p $(PSDB_PROTO_OUT)

GO_INSTALL := env GOBIN=$(PWD)/$(BIN) go install

$(BIN)/protoc-gen-go: Makefile | $(BIN)
	$(GO_INSTALL) google.golang.org/protobuf/cmd/protoc-gen-go@v1.28.1

$(BIN)/protoc-gen-connect-go: Makefile | $(BIN)
	$(GO_INSTALL) github.com/bufbuild/connect-go/cmd/protoc-gen-connect-go@v0.4.0

$(BIN)/protoc-gen-go-vtproto: Makefile | $(BIN)
	$(GO_INSTALL) github.com/planetscale/vtprotobuf/cmd/protoc-gen-go-vtproto@v0.3.0

ifeq ($(UNAME_OS),Darwin)
PROTOC_OS := osx
ifeq ($(UNAME_ARCH),arm64)
PROTOC_ARCH := aarch_64
else
PROTOC_ARCH := x86_64
endif
endif
ifeq ($(UNAME_OS),Linux)
PROTOC_OS = linux
ifeq ($(UNAME_ARCH),aarch64)
PROTOC_ARCH := aarch_64
else
PROTOC_ARCH := $(UNAME_ARCH)
endif
endif

$(BIN)/protoc: | $(BIN)
	rm -rf tmp-protoc
	mkdir -p tmp-protoc
	wget -O tmp-protoc/protoc.zip https://github.com/protocolbuffers/protobuf/releases/download/v$(PROTOC_VERSION)/protoc-$(PROTOC_VERSION)-$(PROTOC_OS)-$(PROTOC_ARCH).zip
	unzip -d tmp-protoc tmp-protoc/protoc.zip
	mv tmp-protoc/bin/protoc $(BIN)/
	rm -rf tmp-protoc

PROTO_TOOLS := $(BIN)/protoc $(BIN)/protoc-gen-go $(BIN)/protoc-gen-connect-go $(BIN)/protoc-gen-go-vtproto
tools: $(PROTO_TOOLS)

$(PSDB_V1ALPHA1)/database.pb.go: $(PROTO_TOOLS) proto-src/psdb/v1alpha1/database.proto | $(PSDB_PROTO_OUT)
	$(BIN)/protoc \
	  --plugin=protoc-gen-go=$(BIN)/protoc-gen-go \
	  --plugin=protoc-gen-go-vtproto=$(BIN)/protoc-gen-go-vtproto \
	  --plugin=protoc-gen-connect-go=$(BIN)/protoc-gen-connect-go \
	  --go_out=$(PSDB_PROTO_OUT) \
	  --go-vtproto_out=$(PSDB_PROTO_OUT) \
	  --connect-go_out=$(PSDB_PROTO_OUT) \
	  --go_opt=paths=source_relative \
	  --go-vtproto_opt=features=marshal+unmarshal+size \
	  --go-vtproto_opt=paths=source_relative \
	  --connect-go_opt=paths=source_relative \
	  -I proto-src \
	  -I proto-src/vitess \
	  proto-src/psdb/v1alpha1/database.proto

run: proto
	go run $(gomod) \
		-http-addr=127.0.0.1 \
		-http-port=8085 \
		-mysql-addr=127.0.0.1 \
		-mysql-port=33807 \
		-mysql-idle-timeout=5s \
		-mysql-no-pass \
		-mysql-max-rows=1000 \
		-mysql-dbname=tests
