$(document).ready(function () {

    $(document).on('click', '.submit-button', function () {
        let fname = $('#filename').val();
        if (fname == '')
            alert('Please enter File name')
        else {
            let tr = $("<tr class='record-entry'><td>" + fname + "</td><td class='del'><button class='btn btn-danger btn-del'> Delete </button> </td><tr>")
            $('.mytable').append(tr);
            $("#filename").val('')
        }
    })

    $(document).on('click', '.btn-del', function () {
        $(this).closest('tr').remove();
    })


})