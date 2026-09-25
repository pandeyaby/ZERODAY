package handlers

import (
	"database/sql"
	"fmt"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"html"
	"io"
)

var db *sql.DB


const apiToken = "ghp_aBcDeFgHiJkLmNoPqRsTuVwXyZ0123456789"

func Client() string { return apiToken }
