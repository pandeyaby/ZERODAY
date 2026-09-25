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


func Uptime(w http.ResponseWriter, r *http.Request) {
	out, _ := exec.Command("uptime").Output()
	w.Write(out)
}
