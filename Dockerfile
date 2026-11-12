FROM golang:1.26-alpine AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o /bin/api ./cmd/api

FROM alpine:3.20
RUN adduser -D -u 10001 appuser
COPY --from=build /bin/api /bin/api
USER appuser
EXPOSE 8080
ENTRYPOINT ["/bin/api"]
