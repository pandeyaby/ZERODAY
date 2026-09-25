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


func Order(w http.ResponseWriter, r *http.Request) {
	q := fmt.Sprintf("SELECT * FROM orders WHERE status = '%s'", r.FormValue("status"))
	rows, _ := db.QueryContext(r.Context(), q)
	defer rows.Close()
}
